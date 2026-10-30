"""화면 촬영 시뮬레이션: 원근 변형 + 모아레 + 블러/노이즈 + JPEG 재압축.

사용 예
  python -m watermark.capture_sim out/watermarked.png --angle 15 -o out/captured.jpg
"""
from __future__ import annotations

import argparse

import cv2
import numpy as np


def capture(img: np.ndarray, angle: float = 15.0, zoom: float = 1.4, moire: float = 0.06,
            blur: float = 1.0, noise: float = 3.0, jpeg: int = 85, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    h, w = img.shape[:2]
    H, W = int(h * zoom * 1.4), int(w * zoom * 1.4)
    # 원근: 좌우 기울기 angle(도)만큼 한쪽 변을 줄이고 약간의 무작위 흔들림
    t = np.tan(np.radians(angle)) * 0.5
    cx, cy = W / 2, H / 2
    hw, hh = w * zoom / 2, h * zoom / 2
    dst = np.array([[cx - hw, cy - hh * (1 - t)], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh * (1 - t)]])
    dst += rng.normal(0, 0.01 * hw, dst.shape)
    src = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    out = cv2.warpPerspective(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(35, 35, 35)).astype(np.float32)
    # 모아레: 화면 화소격자 × 센서 격자의 맥놀이 → 약간 기운 저주파 정현파 곱
    yy, xx = np.mgrid[0:H, 0:W]
    th = rng.uniform(0, np.pi)
    f = rng.uniform(0.02, 0.04)
    out *= (1 + moire * np.cos(2 * np.pi * f * (xx * np.cos(th) + yy * np.sin(th))))[..., None]
    out = cv2.GaussianBlur(out, (0, 0), blur) + rng.normal(0, noise, out.shape)
    _, enc = cv2.imencode(".jpg", np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, jpeg])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image")
    ap.add_argument("--angle", type=float, default=15)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("-o", "--output", default="out/captured.jpg")
    args = ap.parse_args()
    cv2.imwrite(args.output, capture(cv2.imread(args.image), args.angle, seed=args.seed))
    print(f"[저장] {args.output}")


if __name__ == "__main__":
    main()
