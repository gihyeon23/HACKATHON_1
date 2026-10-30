"""검출: 촬영본 → 문서 복원 → 타일별 A/B 에너지 누적 → 후보 매칭(z-score) / RS 복호 → 수신자 ID.

엔진은 이름을 모름. 후보(candidates)는 [{"id": int, "size": [w, h], ...}] 형태로 호출자(백엔드)가 넘김.

사용 예 (watermark/ 에서)
  python -m watermark.detect photo.jpg --candidates candidates.json
  python -m watermark.detect photo.jpg --candidates c.json --reference issued.png   # 배포본 기준 정렬 (권장)
  python -m watermark.detect photo.jpg --candidates c.json --corners 120,80,1900,95,1880,1400,110,1390
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import cv2
import numpy as np
from reedsolo import RSCodec

from .embed import strip_frame
from .restore import align_to_reference, find_document, remove_moire, warp
from .utils import (BAND, PARAM_SETS, RS_NSYM, Layout, build_layout, encode_payload, texture_mask, tile_pattern,
                    tile_to, to_gray)

Z_THRESH = 5.0     # 후보 매칭 임계 z (무워터마크 오탐 확률 ≈ 후보 수 × 3e-7)


def tile_soft_bits(y: np.ndarray, layout: Layout, clip: float = 4.0) -> np.ndarray:
    """T×T 창을 반씩 겹쳐 훑으며 창마다 A/B 에너지를 누적 → 연판정(-1..1).

    워터마크가 주기 T이므로 어느 위치의 T×T 창이든 정확히 정수 주기를 담음 → 오프셋 불변.
    창마다 따로 에너지를 구해 더하므로(비동기 누적) 원근 보정 잔여 오차에 강함.
    계수 에너지를 창 내 중앙값으로 정규화 후 clip 배로 상한 → 모아레·원본 피크가 소수 빈을 독식하지 못함.
    """
    T = layout.tile
    hp = y - cv2.GaussianBlur(y, (0, 0), 3)          # 저주파 원본 성분 제거
    pu, pv = layout.pos[..., 0], layout.pos[..., 1]
    acc = np.zeros(layout.pos.shape[:2])
    h, w = y.shape
    for i in range(0, max(h - T, 0) + 1, T // 2):
        for j in range(0, max(w - T, 0) + 1, T // 2):
            E = np.abs(np.fft.fft2(hp[i:i + T, j:j + T])) ** 2
            e = E[pu, pv]
            acc += np.minimum(e / (np.median(e) + 1e-12), clip).sum(-1)
    return (acc[:, 0] - acc[:, 1]) / (acc[:, 0] + acc[:, 1] + 1e-12)


def rs_decode(soft: np.ndarray) -> int | None:
    """경판정 복호 → 실패 시 신뢰도 낮은 바이트를 소거(erasure)로 지정해 재시도."""
    rs = RSCodec(RS_NSYM)
    bits = (soft > 0).astype(np.uint8)
    data = bytearray(np.packbits(bits).tobytes())
    conf = np.abs(soft).reshape(-1, 8).min(1)          # 바이트 신뢰도 = 가장 약한 비트
    order = list(np.argsort(conf))
    for n_era in range(0, RS_NSYM // 2 + 1):          # 패리티 절반은 검증용으로 남김 (오복호 방지)
        for era in ([order[:n_era]] if n_era else [[]]):
            try:
                msg = rs.decode(data, erase_pos=[int(e) for e in era] or None)[0]
                return int.from_bytes(bytes(msg), "big")
            except Exception:
                pass
    return None


def match_candidates(soft: np.ndarray, candidates: list[dict]) -> tuple[dict | None, float, float]:
    """후보 수신자 부호어와 연판정 상관 → z-score. 무워터마크면 z ~ N(0,1).

    배포 대상을 알고 있으므로 RS 블라인드 복호보다 강인한 최대우도 판정이 가능.
    반환: (최고 후보, 최고 z, 2위 z)
    """
    if not candidates:
        return None, 0.0, 0.0
    zs = candidate_scores(soft, candidates)
    order = np.argsort(zs)[::-1]
    return candidates[order[0]], zs[order[0]], (zs[order[1]] if len(zs) > 1 else 0.0)


def candidate_scores(soft: np.ndarray, candidates: list[dict]) -> list[float]:
    norm = np.sqrt(np.sum(soft ** 2)) + 1e-12
    return [float(np.dot(soft, 2.0 * encode_payload(c["id"]) - 1) / norm) for c in candidates]


def detect_gray(y: np.ndarray, layout: Layout, scales=np.arange(0.97, 1.0301, 0.005)) -> dict:
    """미세 스케일 탐색: 원근 보정 잔여 스케일 오차를 보정, 신뢰도 최대인 스케일 채택."""
    best = None
    for s in scales:
        ys = y if abs(s - 1) < 1e-6 else cv2.resize(y, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
        soft = tile_soft_bits(ys, layout)
        score = float(np.mean(np.abs(soft)))
        if best is None or score > best["score"]:
            best = dict(scale=float(s), score=score, soft=soft)
    best["id"] = rs_decode(best["soft"])
    return best


N_NULL = 64   # 정보 결합 검출의 귀무분포 추정용 무작위 ID 수


def coherent_scores(y: np.ndarray, ref: np.ndarray, key: str, candidates: list[dict],
                    tile: int = 256) -> tuple[list[float], str]:
    """정보 결합(informed) 상관 검출: 기준 이미지로 정밀 정렬된 촬영본 y와 후보별 예상 워터마크를 위상까지 직접 상관.

    예상 워터마크 = 텍스처 마스크(기준 이미지로 계산) × 키·ID로 재현한 타일 패턴. 에너지 비교보다 훨씬 민감해
    신호가 약한 배포본도 검출. 무작위 ID N_NULL개의 점수로 귀무분포(평균·표준편차)를 추정해 z로 정규화.
    구버전 파라미터(PARAM_SETS)도 모두 시도해 최대 z를 낸 버전 채택.
    반환: (후보별 z, 버전)
    """
    h, w = y.shape
    yh = y - cv2.GaussianBlur(y, (0, 0), 3)
    yh = (yh / (yh.std() + 1e-9)).astype(np.float32)
    g = to_gray(ref).astype(np.float32)
    null_ids = [int(x) for x in np.random.default_rng(0).integers(0, 2 ** 32, N_NULL)]
    best = None
    for ver, p in PARAM_SETS.items():
        layout = build_layout(key, tile, p["band"])
        mask = texture_mask(g, lo=p["lo"]).astype(np.float32)

        def score(rid):
            pat = mask * tile_to((h, w), tile_pattern(layout, encode_payload(rid))[0]).astype(np.float32)
            return float((yh * pat).sum() / (np.sqrt((pat * pat).sum()) + 1e-9))

        null = np.array([score(r) for r in null_ids])
        zs = [(score(c["id"]) - null.mean()) / (null.std() + 1e-9) for c in candidates]
        if best is None or max(zs, default=0) > max(best[0], default=0):
            best = (zs, ver)
    return best


def locate(photo: np.ndarray, corners=None, references=None) -> list[tuple[np.ndarray, str, tuple | None]]:
    """문서 정렬 후보 목록. 수동 코너가 있으면 그것만, 없으면 기준 이미지 특징점 정렬 + 테두리 사각형 검출.

    반복 문구가 많은 문서는 특징점이 엉뚱하게 매칭될 수 있고, 테두리는 베젤에 묻힐 수 있어 둘 다 후보로 두고
    검출 신뢰도(z)가 높은 쪽을 채택 (detect 참고).
    반환: [(촬영본 상 문서 네 모서리, 방식 "manual"|"reference"|"frame", 정렬에 쓴 기준 이미지 또는 None)]
    """
    if corners is not None:
        return [(np.asarray(corners, np.float32), "manual", None)]
    out = []
    best = (None, 0, None)
    for ref in references or []:
        c, n = align_to_reference(photo, ref)
        if c is not None and n > best[1] and cv2.isContourConvex(c.astype(np.float32).reshape(-1, 1, 2)):
            best = (c, n, ref)
    if best[0] is not None:
        out.append((best[0], "reference", best[2]))
    c = find_document(photo)
    if c is not None:
        out.append((c, "frame", None))
    return out


def detect(photo: np.ndarray, key: str, candidates: list[dict], corners=None, restore=True,
           moire=True, tile=256, band=BAND, references: list[np.ndarray] | None = None) -> dict:
    """촬영본 → 결과 dict.

    references: 기준 이미지(배포본, 테두리 제외) 목록. 있으면 특징점 정렬로 원근 보정 → 테두리가 가려져도 동작.
    found: 판정 성공 여부, recipient_id: 판정된 ID(없으면 None), via: "match"(후보 매칭) | "rs"(RS 블라인드 복호)
    alignment: "manual" | "reference" | "frame", error: 문서 검출 실패 시 사유
    """
    layout = build_layout(key, tile, band)
    all_sizes = sorted({tuple(c["size"]) for c in candidates}) if candidates else [None]
    if restore:
        trials = locate(photo, corners, references)
        if not trials:
            return dict(found=False, error="NO_DOCUMENT")
    else:
        trials = [(None, None, None)]

    results = []
    for c, alignment, ref in trials:
        ref_size = None if ref is None else (ref.shape[1], ref.shape[0])
        sizes = [ref_size] if ref_size else (all_sizes if c is not None else [None])   # 기준 이미지와 같은 크기로 복원
        for size in sizes:
            img = photo if c is None or size is None else warp(photo, c, size)
            y = to_gray(img).astype(np.float64)
            n_peaks = 0
            if moire:
                y, n_peaks = remove_moire(y, band)
            r = detect_gray(y, layout)
            r.update(size=size, moire_peaks=n_peaks, restored=img, corners=c, alignment=alignment)
            r["match"], r["z"], r["z2"] = match_candidates(r["soft"], candidates)
            r["coherent"] = None
            if ref is not None and candidates:            # 기준 이미지로 정밀 정렬된 경우에만 정보 결합 검출
                zs, ver = coherent_scores(to_gray(img).astype(np.float32), ref, key, candidates, tile)
                r["coherent"] = dict(zs=zs, version=ver)
            results.append(r)
    best = max(results, key=lambda r: (r["z"], r["score"]))
    coh = max((r for r in results if r["coherent"]), key=lambda r: max(r["coherent"]["zs"]), default=None)
    if coh is not None and max(coh["coherent"]["zs"]) >= Z_THRESH and max(coh["coherent"]["zs"]) > best["z"]:
        zs = coh["coherent"]["zs"]
        order = np.argsort(zs)[::-1]
        best = coh
        best["z"], best["z2"] = float(zs[order[0]]), float(zs[order[1]]) if len(zs) > 1 else 0.0
        best["recipient_id"], best["via"], best["version"] = candidates[order[0]]["id"], "coherent", coh["coherent"]["version"]
        best["ranking"] = sorted(({"id": c["id"], "z": float(z)} for c, z in zip(candidates, zs)), key=lambda e: -e["z"])
        best["found"] = True
        return best
    if best["z"] >= Z_THRESH:
        best["recipient_id"], best["via"] = best["match"]["id"], "match"
    else:
        known = {c["id"] for c in candidates}
        rid = best["id"]                                # RS 복호값은 후보에 있을 때만 인정 (오복호 방지)
        best["recipient_id"], best["via"] = (rid, "rs") if rid is not None and (rid in known or not candidates) else (None, None)
    best["found"] = best["recipient_id"] is not None
    best["ranking"] = sorted(({"id": c["id"], "z": z} for c, z in zip(candidates, candidate_scores(best["soft"], candidates))),
                             key=lambda e: -e["z"])
    return best


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--key", default="poc-secret-key")
    ap.add_argument("--candidates", help='후보 JSON 파일 [{"id":..,"size":[w,h],"name":..(선택)}]')
    ap.add_argument("--corners", help="수동 코너 x1,y1,...,x4,y4 (좌상→우상→우하→좌하)")
    ap.add_argument("--reference", action="append", default=[], help="기준 이미지: 배포본 PNG (테두리 포함, 여러 번 지정 가능)")
    ap.add_argument("--no-restore", action="store_true", help="원근 보정 생략 (원본 크기 이미지 검사용)")
    ap.add_argument("--no-moire", action="store_true", help="모아레 노치 필터 끄기")
    args = ap.parse_args()

    photo = cv2.imread(args.photo, cv2.IMREAD_COLOR)
    if photo is None:
        raise SystemExit(f"이미지를 읽을 수 없음: {args.photo}")
    cands = json.loads(Path(args.candidates).read_text()) if args.candidates else []
    corners = np.array(args.corners.split(","), np.float32).reshape(4, 2) if args.corners else None
    t0 = time.perf_counter()
    refs = [strip_frame(cv2.imread(p, cv2.IMREAD_COLOR)) for p in args.reference]
    r = detect(photo, args.key, cands, corners, not args.no_restore, not args.no_moire, references=refs)
    dt = time.perf_counter() - t0

    if r.get("error"):
        print(f"[실패] {r['error']} (문서 사각형 검출 실패 → --corners 로 수동 지정)")
        return
    Path("out").mkdir(exist_ok=True)
    cv2.imwrite("out/detect_restored.png", r["restored"])
    print(f"[정렬] {r['alignment']}")
    print(f"[복원] 코너={None if r['corners'] is None else r['corners'].round(1).tolist()}  "
          f"크기={r['size']}  스케일보정={r['scale']:.3f}  모아레피크={r['moire_peaks']}")
    print(f"[신뢰도] mean|soft|={r['score']:.3f}  1위 z={r['z']:.1f}  2위 z={r['z2']:.1f}  (임계 {Z_THRESH})")
    names = {c["id"]: c.get("name", c["id"]) for c in cands}
    if r["found"]:
        print(f"[결과] 유출자 = {names.get(r['recipient_id'], r['recipient_id'])}  (ID={r['recipient_id']}, {r['via']})")
    else:
        print("[결과] 워터마크 검출 실패")
    print(f"[시간] {dt:.2f} s   복원 이미지: out/detect_restored.png")


if __name__ == "__main__":
    main()
