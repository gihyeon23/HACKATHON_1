"""공통 유틸: FFT 헬퍼, 켤레대칭 처리, 키→패턴 생성, 페이로드(ECC), 품질 지표, 샘플 이미지.

워터마크 설계 요약
- 타일(T×T) 단위 FFT 중주파 링에 패턴을 설계 → 역FFT → 이미지 전체에 주기적으로 타일링
  (역FFT로 만든 패턴은 주기 T로 이음매 없이 반복되므로 블록 경계 아티팩트 없음)
- 비트마다 키로 정한 두 계수 집합 A/B 중 하나에만 에너지를 실음 (bit=1→A, bit=0→B)
  → 검출은 |F|² 에너지 비교라 이동(크롭 오프셋)에 불변
- 모든 타일이 같은 페이로드를 담으므로 부분 촬영/크롭에도 남은 타일로 복원 가능
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

import cv2
import numpy as np
from reedsolo import RSCodec

ID_BYTES = 4          # 32bit 수신자 ID
RS_NSYM = 4           # 리드솔로몬 패리티 바이트 (최대 2바이트 오류 정정)
N_BITS = (ID_BYTES + RS_NSYM) * 8
BAND = (0.06, 0.25)   # 삽입 대역 (나이퀴스트 대비). 상단(>0.25)은 폰 카메라 노이즈 제거·블러에 소실
MASK_LO = 0.8         # 텍스처 마스크 하한
# 삽입 파라미터 버전 (검출 시 구버전 배포본도 함께 검사). v1: #3 이전
PARAM_SETS = {"v2": dict(band=BAND, lo=MASK_LO), "v1": dict(band=(0.10, 0.35), lo=0.4)}


# ---------------------------------------------------------------- 키 / 페이로드
def key_rng(key: str, tag: str) -> np.random.Generator:
    """비밀키 + 용도 태그 → 결정적 난수 생성기 (삽입기·검출기가 동일 패턴 재현)."""
    digest = hashlib.sha256(f"{key}|{tag}".encode()).digest()
    return np.random.default_rng(int.from_bytes(digest[:8], "big"))


def encode_payload(recipient_id: int) -> np.ndarray:
    """32bit ID → RS 부호화 → 비트열(0/1, 길이 N_BITS)."""
    code = RSCodec(RS_NSYM).encode(recipient_id.to_bytes(ID_BYTES, "big"))
    return np.unpackbits(np.frombuffer(bytes(code), dtype=np.uint8))


def decode_payload(bits: np.ndarray) -> int | None:
    """비트열 → RS 복호 → ID. 정정 불가면 None."""
    data = np.packbits(bits.astype(np.uint8)).tobytes()
    try:
        msg = RSCodec(RS_NSYM).decode(data)[0]
    except Exception:
        return None
    return int.from_bytes(bytes(msg), "big")


# ---------------------------------------------------------------- FFT 헬퍼
def fft2c(x: np.ndarray) -> np.ndarray:
    """중심 정렬(fftshift) 2D FFT."""
    return np.fft.fftshift(np.fft.fft2(x))


def log_spectrum(x: np.ndarray) -> np.ndarray:
    return np.log1p(np.abs(fft2c(x - x.mean())))


def hermitian_symmetrize(X: np.ndarray) -> np.ndarray:
    """X[k] ← (X[k] + conj(X[-k]))/2  (비시프트 좌표).  역FFT 결과가 실수가 됨을 보장."""
    X_neg = np.roll(np.flip(X, axis=(0, 1)), 1, axis=(0, 1))   # X[-k mod N]
    return 0.5 * (X + np.conj(X_neg))


# ---------------------------------------------------------------- 키 → 패턴
@dataclass
class Layout:
    tile: int
    band: tuple[float, float]
    pos: np.ndarray      # (N_BITS, 2[A/B], K, 2[u,v]) 비시프트 FFT 인덱스
    phase: np.ndarray    # (N_BITS, 2, K) 키 기반 랜덤 위상 → 공간 패턴이 잡음처럼 보이게


def build_layout(key: str, tile: int = 256, band=BAND, n_bits: int = N_BITS,
                 axis_guard: int = 2) -> Layout:
    """중주파 링(나이퀴스트 대비 band 비율)에서 비트별 A/B 계수 집합을 키로 선택.

    - 반평면만 선택하고 나머지는 켤레대칭으로 채움
    - 축 근처(|u|,|v| < axis_guard)는 제외: JPEG 8×8 블록·화면 격자 성분이 축에 몰림
    """
    f = np.fft.fftfreq(tile)                       # cycles/pixel, 나이퀴스트 = 0.5
    fu, fv = np.meshgrid(f, f, indexing="ij")
    r = np.hypot(fu, fv) / 0.5
    iu, iv = np.meshgrid(np.arange(tile), np.arange(tile), indexing="ij")
    du, dv = np.minimum(iu, tile - iu), np.minimum(iv, tile - iv)
    half = (fv > 0) | ((fv == 0) & (fu > 0))
    ok = (r >= band[0]) & (r <= band[1]) & half & (du >= axis_guard) & (dv >= axis_guard)
    cand = np.argwhere(ok)

    k = len(cand) // (2 * n_bits)
    if k < 4:
        raise ValueError(f"대역 계수 부족(K={k}): tile 또는 band를 키우세요")
    rng = key_rng(key, f"layout:{tile}:{band}")
    cand = cand[rng.permutation(len(cand))[: n_bits * 2 * k]]
    pos = cand.reshape(n_bits, 2, k, 2)
    phase = key_rng(key, "phase").uniform(0, 2 * np.pi, size=(n_bits, 2, k))
    return Layout(tile, tuple(band), pos, phase)


def tile_pattern(layout: Layout, bits: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """비트열 → 타일 스펙트럼 X(비시프트) → 실수 공간 패턴 w(표준편차 1)."""
    T = layout.tile
    X = np.zeros((T, T), complex)
    sel = bits.astype(int) ^ 1                     # bit=1 → A(0), bit=0 → B(1)
    idx = np.arange(len(bits))
    p, ph = layout.pos[idx, sel], layout.phase[idx, sel]
    X[p[..., 0], p[..., 1]] = np.exp(1j * ph)
    X = hermitian_symmetrize(X)
    w = np.fft.ifft2(X)
    assert np.abs(w.imag).max() < 1e-9 * np.abs(w.real).max(), "켤레대칭 깨짐"
    w = w.real
    return w / w.std(), X


def tile_to(shape, w: np.ndarray) -> np.ndarray:
    """타일 패턴을 이미지 크기로 주기 반복."""
    h, wd = shape
    T = w.shape[0]
    return np.tile(w, (-(-h // T), -(-wd // T)))[:h, :wd]


def fold_tiles(x: np.ndarray, T: int) -> np.ndarray:
    """이미지를 T×T로 접어 평균 (주기 워터마크는 누적, 비주기 잡음은 상쇄)."""
    h, w = x.shape
    acc, n = np.zeros((T, T)), np.zeros((T, T))
    for i in range(0, h, T):
        for j in range(0, w, T):
            blk = x[i:i + T, j:j + T]
            acc[: blk.shape[0], : blk.shape[1]] += blk
            n[: blk.shape[0], : blk.shape[1]] += 1
    return acc / np.maximum(n, 1)


def soft_bits(folded: np.ndarray, layout: Layout) -> np.ndarray:
    """접힌 타일의 A/B 집합 에너지 비교 → 연판정 값(-1..1, 양수=bit 1)."""
    E = np.abs(np.fft.fft2(folded - folded.mean())) ** 2
    e = E[layout.pos[..., 0], layout.pos[..., 1]].sum(axis=-1)   # (N_BITS, 2)
    return (e[:, 0] - e[:, 1]) / (e[:, 0] + e[:, 1] + 1e-12)


# ---------------------------------------------------------------- 지각 마스크
def texture_mask(y: np.ndarray, sigma: float = 4.0, ref: float = 12.0,
                 lo: float = MASK_LO, hi: float = 2.0) -> np.ndarray:
    """국소 표준편차 기반 강도 맵: 질감 많은 곳↑, 평탄한 곳↓ (비가시성 확보).

    lo=0.8: 슬라이드처럼 평탄한 문서도 신호가 남도록 하한을 높게 유지.
    """
    mu = cv2.GaussianBlur(y, (0, 0), sigma)
    var = cv2.GaussianBlur(y * y, (0, 0), sigma) - mu * mu
    m = np.clip(np.sqrt(np.maximum(var, 0)) / ref, lo, hi)
    return cv2.GaussianBlur(m, (0, 0), sigma)


# ---------------------------------------------------------------- 지표
def psnr(a: np.ndarray, b: np.ndarray) -> float:
    mse = np.mean((a.astype(float) - b.astype(float)) ** 2)
    return float("inf") if mse == 0 else 10 * np.log10(255.0 ** 2 / mse)


def ssim(a: np.ndarray, b: np.ndarray) -> float:
    """가우시안 윈도우(σ=1.5) SSIM, 그레이스케일 입력."""
    a, b = a.astype(float), b.astype(float)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    g = lambda x: cv2.GaussianBlur(x, (11, 11), 1.5)
    ma, mb = g(a), g(b)
    va, vb, cov = g(a * a) - ma ** 2, g(b * b) - mb ** 2, g(a * b) - ma * mb
    s = ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma ** 2 + mb ** 2 + c1) * (va + vb + c2))
    return float(s.mean())


# ---------------------------------------------------------------- 이미지 I/O
def to_gray(img: np.ndarray) -> np.ndarray:
    return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def limit_size(img: np.ndarray, max_side: int | None) -> np.ndarray:
    """화면에 100%(1:1)로 띄울 수 있게 긴 변 제한."""
    if not max_side or max(img.shape[:2]) <= max_side:
        return img
    s = max_side / max(img.shape[:2])
    return cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)


def make_sample(h: int = 768, w: int = 1024, seed: int = 0) -> np.ndarray:
    """테스트용 합성 이미지: 문서(텍스트·표) + 사진 같은 질감 영역."""
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), 245, np.uint8)
    cv2.putText(img, "CONFIDENTIAL - Q4 Roadmap", (40, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (30, 30, 30), 3)
    for i in range(14):
        y = 120 + i * 30
        n = rng.integers(25, 45)
        txt = " ".join("".join(rng.choice(list("abcdefghijklmnopqrstuvwxyz"), rng.integers(2, 9))) for _ in range(n // 5))
        cv2.putText(img, txt, (40, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 50, 50), 1, cv2.LINE_AA)
    for r in range(6):
        cv2.line(img, (40, 560 + r * 30), (480, 560 + r * 30), (120, 120, 120), 1)
    for c in range(5):
        cv2.line(img, (40 + c * 110, 560), (40 + c * 110, 710), (120, 120, 120), 1)
    # 사진 영역: 그라디언트 + 도형 + 잡음 질감
    ph = np.zeros((h - 480, w - 560, 3), np.float32)
    yy, xx = np.mgrid[0:ph.shape[0], 0:ph.shape[1]]
    ph[..., 0] = 90 + 80 * xx / ph.shape[1]
    ph[..., 1] = 140 + 60 * yy / ph.shape[0]
    ph[..., 2] = 200 - 70 * xx / ph.shape[1]
    for _ in range(12):
        c = (int(rng.integers(0, ph.shape[1])), int(rng.integers(0, ph.shape[0])))
        cv2.circle(ph, c, int(rng.integers(10, 60)), rng.uniform(40, 230, 3).tolist(), -1)
    ph += cv2.GaussianBlur(rng.normal(0, 25, ph.shape).astype(np.float32), (0, 0), 1.2)
    img[480 - 60:h - 60, 520:520 + ph.shape[1]] = np.clip(ph, 0, 255).astype(np.uint8)
    return img
