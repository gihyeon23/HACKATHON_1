"""시연용 샘플 설계도(1280×720)를 만든다. 실제 문서가 아니라 샘플 데이터다."""
from pathlib import Path

import cv2
import numpy as np

SAMPLE_PATH = Path(__file__).resolve().parent / "demo" / "sample_blueprint.png"
INK = (90, 60, 30)


def make_sample_doc(seed: int = 7):
    rng = np.random.default_rng(seed)
    img = np.full((720, 1280, 3), (245, 240, 235), np.uint8)
    for x in range(40, 1280, 40):
        cv2.line(img, (x, 0), (x, 720), (232, 224, 215), 1)
    for y in range(40, 720, 40):
        cv2.line(img, (0, y), (1280, y), (232, 224, 215), 1)

    cv2.rectangle(img, (30, 30), (1250, 690), INK, 2)
    cv2.putText(img, "Q4 PRODUCT BLUEPRINT - SAMPLE DATA", (50, 75), cv2.FONT_HERSHEY_SIMPLEX, 1, INK, 2, cv2.LINE_AA)
    for _ in range(14):
        x, y = int(rng.integers(60, 1000)), int(rng.integers(110, 560))
        w, h = int(rng.integers(50, 220)), int(rng.integers(40, 120))
        cv2.rectangle(img, (x, y), (x + w, y + h), INK, 1, cv2.LINE_AA)
        cv2.putText(img, f"P-{rng.integers(100, 999)}", (x + 6, y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, INK, 1, cv2.LINE_AA)
    for _ in range(10):
        c = (int(rng.integers(80, 1200)), int(rng.integers(120, 640)))
        cv2.circle(img, c, int(rng.integers(12, 60)), INK, 1, cv2.LINE_AA)
    for i in range(6):
        y = 590 + i * 16
        cv2.line(img, (900, y), (900 + int(rng.integers(120, 320)), y), INK, 1)
    cv2.putText(img, "CONFIDENTIAL", (960, 670), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (60, 60, 200), 2, cv2.LINE_AA)
    return img


if __name__ == "__main__":
    SAMPLE_PATH.parent.mkdir(exist_ok=True)
    cv2.imwrite(str(SAMPLE_PATH), make_sample_doc())
    print(f"저장: {SAMPLE_PATH}")
