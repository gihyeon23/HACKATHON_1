"""촬영본 복원: 문서 정렬(기준 이미지 특징점 매칭 또는 사각형 검출) → 호모그래피로 원근 보정 → (선택) 모아레 노치 필터.

사용 예 (watermark/ 에서)
  python -m watermark.restore photo.jpg --size 1024x768 -o out/restored.png
  python -m watermark.restore photo.jpg --size 1024x768 --corners 120,80,1900,95,1880,1400,110,1390
"""
from __future__ import annotations

import argparse

import cv2
import numpy as np

from .utils import BAND


def order_corners(pts: np.ndarray) -> np.ndarray:
    """4점 → 좌상, 우상, 우하, 좌하 순서."""
    pts = pts.reshape(4, 2).astype(np.float32)
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], np.float32)


def find_document(img: np.ndarray) -> np.ndarray | None:
    """밝은 문서 영역(검은 프레임 안쪽)을 가장 큰 사각형 윤곽으로 검출. 실패 시 None."""
    g = img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    scale = 1000 / max(g.shape)
    small = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else g
    scale = min(scale, 1.0)
    blur = cv2.GaussianBlur(small, (5, 5), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # 바깥 윤곽만 쓰므로 글자 구멍은 메울 필요 없음. 큰 closing은 얇은 베젤 틈을 메워 배경과 붙어버림
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))    # 반사광 등 가는 연결선 끊기
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(c) < 0.05 * th.size:
            break
        peri = cv2.arcLength(c, True)
        for eps in (0.01, 0.02, 0.03, 0.05):
            q = cv2.approxPolyDP(c, eps * peri, True)
            if len(q) == 4 and cv2.isContourConvex(q):
                q = q.reshape(4, 2).astype(np.float32) / scale
                return refine_corners(g, order_corners(q))
    return None


MIN_INLIERS = 30   # 기준 이미지 정렬 성공 판정 최소 RANSAC inlier 수


def align_to_reference(img: np.ndarray, ref: np.ndarray, max_side: int = 1600) -> tuple[np.ndarray | None, int]:
    """기준 이미지(배포본, 테두리 제외) ↔ 촬영본 ORB 특징점 매칭 → 기준 이미지 네 모서리의 촬영본 좌표.

    테두리가 베젤과 합쳐지거나 가려져도 문서 내용으로 정렬 → 테두리 검출보다 정확.
    반환: (코너 또는 None, inlier 수)
    """
    def gray_small(x):
        g = x if x.ndim == 2 else cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)
        s = min(1.0, max_side / max(g.shape))
        return (cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else g), s

    g0, s0 = gray_small(ref)
    g1, s1 = gray_small(img)
    orb = cv2.ORB_create(5000)
    k0, d0 = orb.detectAndCompute(g0, None)
    k1, d1 = orb.detectAndCompute(g1, None)
    if d0 is None or d1 is None or len(k0) < MIN_INLIERS or len(k1) < MIN_INLIERS:
        return None, 0
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(d0, d1, k=2)
    good = [a for a, b in (p for p in pairs if len(p) == 2) if a.distance < 0.75 * b.distance]   # Lowe ratio test
    if len(good) < MIN_INLIERS:
        return None, len(good)
    p0 = np.float32([k0[m.queryIdx].pt for m in good]) / s0
    p1 = np.float32([k1[m.trainIdx].pt for m in good]) / s1
    H, inl = cv2.findHomography(p0, p1, cv2.RANSAC, 4.0 / s1)
    n = int(inl.sum()) if inl is not None else 0
    if H is None or n < MIN_INLIERS:
        return None, n
    h, w = ref.shape[:2]
    return cv2.perspectiveTransform(np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])[None], H)[0], n


def refine_corners(gray: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """서브픽셀 코너 정밀화 (원근 보정 오차가 곧 타일 주기 오차가 되므로 중요)."""
    c = corners.reshape(-1, 1, 2).copy()
    win = max(3, int(max(gray.shape) / 400))
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.01)
    cv2.cornerSubPix(gray, c, (win, win), (-1, -1), crit)
    return c.reshape(4, 2)


def warp(img: np.ndarray, corners: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    w, h = size
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], np.float32)
    H = cv2.getPerspectiveTransform(order_corners(corners), dst)
    return cv2.warpPerspective(img, H, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def remove_moire(y: np.ndarray, protect_band=BAND, k: float = 12.0, radius: int = 3) -> tuple[np.ndarray, int]:
    """스펙트럼의 고립된 강한 피크(모아레)를 가우시안 노치로 제거.

    워터마크 대역(protect_band, 나이퀴스트 대비) 안쪽은 건드리지 않음 → 워터마크 손상 방지.
    반환: (필터링된 영상, 제거한 피크 수)
    """
    F = np.fft.fftshift(np.fft.fft2(y - y.mean()))
    mag = np.log1p(np.abs(F)).astype(np.float32)
    bg = cv2.medianBlur(mag, 5)
    h, w = y.shape
    fu = np.fft.fftshift(np.fft.fftfreq(h))[:, None]
    fv = np.fft.fftshift(np.fft.fftfreq(w))[None, :]
    r = np.hypot(fu, fv) / 0.5
    cand = (mag - bg > np.log(k)) & (r > 0.04) & ((r < protect_band[0]) | (r > protect_band[1]))
    cand &= mag == cv2.dilate(mag, np.ones((5, 5), np.uint8))       # 국소 최대만
    peaks = np.argwhere(cand)
    if len(peaks) == 0:
        return y, 0
    yy, xx = np.mgrid[0:h, 0:w]
    notch = np.ones((h, w))
    for py, px in peaks:
        notch *= 1 - np.exp(-((yy - py) ** 2 + (xx - px) ** 2) / (2 * radius ** 2))
    out = np.real(np.fft.ifft2(np.fft.ifftshift(F * notch))) + y.mean()
    return out, len(peaks)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--size", required=True, help="원본 크기 WxH")
    ap.add_argument("--corners", help="수동 코너 x1,y1,...,x4,y4")
    ap.add_argument("-o", "--output", default="out/restored.png")
    args = ap.parse_args()
    img = cv2.imread(args.photo, cv2.IMREAD_COLOR)
    c = (np.array(args.corners.split(","), np.float32).reshape(4, 2) if args.corners else find_document(img))
    if c is None:
        raise SystemExit("문서 사각형 검출 실패 → --corners 로 수동 지정")
    w, h = map(int, args.size.lower().split("x"))
    cv2.imwrite(args.output, warp(img, c, (w, h)))
    print(f"코너={c.round(1).tolist()}  [저장] {args.output}")


if __name__ == "__main__":
    main()
