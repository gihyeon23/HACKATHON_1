"""워터마크 삽입: 이미지 → Y(휘도) 채널 FFT 중주파에 키 기반 패턴 삽입 → PSNR/SSIM 출력 + 시각화.

사용 예 (watermark/ 에서)
  python -m watermark.embed                                   # 합성 샘플 이미지로 실행
  python -m watermark.embed -i doc.png --id 1234 --key secret --strength 3
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import cv2
import matplotlib
import numpy as np

from .utils import (BAND, N_BITS, Layout, build_layout, decode_payload, encode_payload, fold_tiles, log_spectrum,
                   psnr, soft_bits, ssim, tile_pattern, tile_to, texture_mask, to_gray, make_sample, limit_size)


def embed(img: np.ndarray, recipient_id: int, key: str, strength: float = 3.0,
          tile: int = 256, band=BAND) -> tuple[np.ndarray, dict]:
    """BGR/그레이 uint8 이미지에 워터마크 삽입. (워터마크 이미지, 디버그 정보) 반환."""
    layout = build_layout(key, tile, band)
    bits = encode_payload(recipient_id)
    w, X = tile_pattern(layout, bits)

    color = img.ndim == 3
    ycc = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb).astype(np.float32) if color else img.astype(np.float32)[..., None]
    y = ycc[..., 0]
    mask = texture_mask(y)
    delta = strength * mask * tile_to(y.shape, w)
    ycc[..., 0] = np.clip(y + delta, 0, 255)
    out = np.round(ycc).astype(np.uint8)
    out = cv2.cvtColor(out, cv2.COLOR_YCrCb2BGR) if color else out[..., 0]
    return out, dict(layout=layout, bits=bits, tile_spec=X, delta=delta, mask=mask)


FRAME = 12   # 촬영본 코너 검출용 검은 테두리 두께(px)


def add_frame(img: np.ndarray, px: int = FRAME) -> np.ndarray:
    """검은 테두리 추가. 검출 시 테두리 안쪽 = 원본 영역으로 원근 보정."""
    return cv2.copyMakeBorder(img, *[px] * 4, cv2.BORDER_CONSTANT, value=0) if px else img


def strip_frame(issued: np.ndarray, px: int = FRAME) -> np.ndarray:
    """배포본(검은 테두리 포함) → 테두리 제외 원본 영역. 검출 시 기준 이미지로 사용."""
    return issued[px:-px, px:-px] if px else issued


TARGET_Z = 6.5                      # 촬영 시뮬레이션 예상 z 목표 (실촬영은 시뮬보다 ~1.5 낮게 나옴, 판정 임계 5.0)
STRENGTHS = (3.0, 3.5, 4.0, 4.5, 5.0)   # 자동 강도 후보 (작은 값부터 → 화질 우선)
SIM_SHOTS = ((0, 0), (25, 1))       # (각도, 시드) — 정면·사선 촬영 중 나쁜 쪽 기준


def predict_z(framed: np.ndarray, recipient_id: int, key: str) -> float:
    """배포본을 촬영 시뮬레이션 → 검출해 예상 z(최소값) 계산."""
    from .capture_sim import capture
    from .detect import detect
    h, w = framed.shape[0] - 2 * FRAME, framed.shape[1] - 2 * FRAME
    cand = [dict(id=recipient_id, size=[w, h])]
    zs = [detect(capture(framed, a, seed=s), key, cand).get("z", 0.0) for a, s in SIM_SHOTS]
    return float(min(zs))


def embed_auto(img: np.ndarray, recipient_id: int, key: str, target_z: float = TARGET_Z,
               strengths=STRENGTHS) -> tuple[np.ndarray, dict]:
    """문서별 자동 강도: 약한 강도부터 삽입해 예상 z가 목표에 닿는 최소 강도를 채택.

    평평한 문서(슬라이드)는 텍스처 마스크 때문에 같은 강도에서도 신호가 약해 더 큰 강도가 필요.
    목표 미달이면 최대 강도 결과를 반환 (info['target_met']=False).
    반환 info: strength, predicted_z, target_met + embed() 디버그 정보
    """
    for s in strengths:
        wm, info = embed(img, recipient_id, key, s)
        z = predict_z(add_frame(wm), recipient_id, key)
        if z >= target_z:
            break
    info.update(strength=s, predicted_z=z, target_met=z >= target_z)
    return wm, info


def self_check(img_wm: np.ndarray, layout: Layout, bits: np.ndarray) -> tuple[float, int | None]:
    """무공격 상태에서 detect.py와 같은 검출기로 바로 검출해 삽입이 제대로 됐는지 확인 (BER, 복원 ID)."""
    from .detect import rs_decode, tile_soft_bits
    sb = tile_soft_bits(to_gray(img_wm).astype(float), layout)
    return float(np.mean((sb > 0) != bits)), rs_decode(sb)


def band_mask(shape, band) -> np.ndarray:
    """fftshift 좌표에서 삽입 대역 링 영역 (시각화용)."""
    fu = np.fft.fftshift(np.fft.fftfreq(shape[0]))[:, None]
    fv = np.fft.fftshift(np.fft.fftfreq(shape[1]))[None, :]
    r = np.hypot(fu, fv) / 0.5
    return (r >= band[0]) & (r <= band[1])


def visualize(orig: np.ndarray, wm: np.ndarray, info: dict, title: str, out_path: Path, show: bool):
    if not show:
        matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    g0, g1 = to_gray(orig).astype(float), to_gray(wm).astype(float)
    diff = g1 - g0
    layout: Layout = info["layout"]
    rgb = lambda x: x if x.ndim == 2 else cv2.cvtColor(x, cv2.COLOR_BGR2RGB)
    lim = max(np.abs(diff).max(), 1e-6)

    # 타일 스펙트럼에서 bit=1(A)/bit=0(B) 중 실제 사용된 계수 위치
    T = layout.tile
    used = np.fft.fftshift(np.abs(info["tile_spec"]) > 0)
    ring = band_mask((T, T), layout.band)

    fig, ax = plt.subplots(2, 3, figsize=(16, 10))
    ax[0, 0].imshow(rgb(orig), cmap="gray"); ax[0, 0].set_title("원본 / Original")
    ax[0, 1].imshow(rgb(wm), cmap="gray"); ax[0, 1].set_title("워터마크 삽입 / Watermarked")
    im = ax[0, 2].imshow(diff, cmap="seismic", vmin=-lim, vmax=lim)
    ax[0, 2].set_title(f"차이 (Y) / Difference  max |Δ|={lim:.1f}"); fig.colorbar(im, ax=ax[0, 2], fraction=0.046)
    ax[1, 0].imshow(log_spectrum(g0), cmap="magma"); ax[1, 0].set_title("원본 스펙트럼 / log|F(orig)|")
    ax[1, 1].imshow(log_spectrum(diff), cmap="magma"); ax[1, 1].set_title("워터마크 스펙트럼 / log|F(Δ)|")
    ax[1, 2].imshow(ring * 0.25, cmap="Greys", vmin=0, vmax=1)
    yy, xx = np.nonzero(used)
    ax[1, 2].scatter(xx, yy, s=3, c="crimson")
    ax[1, 2].set_title(f"타일 {T}×{T} 삽입 계수 (회색=대역 {layout.band})")
    for a in ax.flat:
        a.set_xticks([]); a.set_yticks([])
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(out_path, dpi=110)
    print(f"[저장] {out_path}")
    if show:
        plt.show()


def _set_korean_font():
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    for name in ("AppleGothic", "Malgun Gothic", "NanumGothic"):
        if any(f.name == name for f in font_manager.fontManager.ttflist):
            plt.rcParams["font.family"] = name
            break
    plt.rcParams["axes.unicode_minus"] = False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-i", "--input", help="입력 이미지 (생략 시 합성 샘플)")
    ap.add_argument("-o", "--output", default="out/watermarked.png")
    ap.add_argument("--id", type=int, default=20251030, help="32bit 수신자 ID")
    ap.add_argument("--frame", type=int, default=FRAME, help="촬영본 코너 검출용 검은 테두리 두께(px), 0=없음")
    ap.add_argument("--key", default="poc-secret-key")
    ap.add_argument("--strength", type=float, default=3.0, help="삽입 강도 (휘도 단위, 클수록 강인·가시성↑)")
    ap.add_argument("--tile", type=int, default=256)
    ap.add_argument("--max-side", type=int, default=1600, help="긴 변 제한 (화면 1:1 표시용)")
    ap.add_argument("--show", action="store_true", help="그림 창 띄우기")
    args = ap.parse_args()

    if not 0 <= args.id < 2 ** 32:
        ap.error("--id 는 0 ~ 2^32-1")
    img = cv2.imread(args.input, cv2.IMREAD_COLOR) if args.input else make_sample()
    if img is None:
        ap.error(f"이미지를 읽을 수 없음: {args.input}")
    img = limit_size(img, args.max_side)

    t0 = time.perf_counter()
    wm, info = embed(img, args.id, args.key, args.strength, args.tile)
    dt = time.perf_counter() - t0

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), add_frame(wm, args.frame))
    cv2.imwrite(str(out.with_name(out.stem + "_original.png")), img)

    p, s = psnr(to_gray(img), to_gray(wm)), ssim(to_gray(img), to_gray(wm))
    ber, rid = self_check(wm, info["layout"], info["bits"])
    k = info["layout"].pos.shape[2]
    print(f"[삽입] {img.shape[1]}x{img.shape[0]}  ID={args.id}  bits={N_BITS}  계수/비트={k}  강도={args.strength}")
    print(f"[화질] PSNR={p:.2f} dB  SSIM={s:.4f}  (목표: PSNR≥38, SSIM≥0.97)")
    print(f"[자체검출] BER={ber:.3f}  복원 ID={rid}  {'OK' if rid == args.id else 'FAIL'}")
    print(f"[시간] 삽입 {dt * 1000:.1f} ms  [저장] {out}")

    _set_korean_font()
    visualize(img, wm, info, f"ID={args.id}  PSNR={p:.2f}dB  SSIM={s:.4f}  strength={args.strength}",
              out.with_name(out.stem + "_viz.png"), args.show)


if __name__ == "__main__":
    main()
