"""회귀 테스트: 삽입 → 촬영 시뮬레이션 → 검출, 그리고 엔진 API.

실행 (watermark/ 에서): python -m pytest tests -q
"""
import base64
import io
import json

import cv2
import numpy as np
import pytest

from watermark.detect import detect
from watermark.embed import TARGET_Z, add_frame, embed, embed_auto, strip_frame
from watermark.capture_sim import capture
from watermark.utils import make_sample

KEY = "test-key"
RID = 2624297755
DECOYS = [1309005247, 2875376312, 423040168]


@pytest.fixture(scope="module")
def sample():
    return make_sample()


@pytest.fixture(scope="module")
def flat_slide():
    """흰 배경 + 글자 위주의 평평한 16:9 슬라이드 (질감 영역 없음)."""
    img = np.full((900, 1600, 3), 240, np.uint8)
    cv2.putText(img, "Schema: rules of data", (80, 140), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (40, 40, 40), 4, cv2.LINE_AA)
    for i in range(12):
        cv2.putText(img, f"line {i}: year INT NOT NULL UNIQUE constraint", (100, 250 + i * 48),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (70, 70, 70), 2, cv2.LINE_AA)
    cv2.rectangle(img, (900, 240), (1500, 760), (225, 230, 240), -1)
    return img


def candidates(img, ids):
    return [dict(id=i, size=[img.shape[1], img.shape[0]]) for i in ids]


@pytest.mark.parametrize("angle", [0, 15, 30])
def test_detects_recipient_after_capture(sample, angle):
    wm, _ = embed(sample, RID, KEY)
    r = detect(capture(add_frame(wm), angle), KEY, candidates(sample, [RID, *DECOYS]))
    assert r["found"] and r["recipient_id"] == RID and r["via"] == "match"
    assert r["z"] >= 5 and r["z2"] < 3


@pytest.mark.parametrize("angle", [0, 20, 30])
def test_flat_slide_auto_strength(flat_slide, angle):
    wm, info = embed_auto(flat_slide, RID, KEY)
    assert info["target_met"] and info["predicted_z"] >= TARGET_Z
    r = detect(capture(add_frame(wm), angle, seed=angle + 7), KEY, candidates(flat_slide, [RID, *DECOYS]))
    assert r["found"] and r["recipient_id"] == RID


def test_reference_alignment_when_frame_hidden():
    """문서 윗변이 밝은 배경에 묻혀 테두리 검출이 틀려도 배포본 대조 정렬로 검출."""
    rng = np.random.default_rng(5)
    slide = np.full((900, 1600, 3), 240, np.uint8)
    for i in range(14):                                          # 줄마다 다른 문구 (특징점 매칭 가능한 실제 문서 유사)
        words = " ".join("".join(rng.choice(list("abcdefghijklmnopqrstuvwxyz"), rng.integers(3, 9))) for _ in range(6))
        cv2.putText(slide, words, (80 + 20 * (i % 3), 120 + i * 55), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (60, 60, 60), 2, cv2.LINE_AA)
    wm, _ = embed_auto(slide, RID, KEY)
    issued = add_frame(wm)
    shot = capture(issued, 20, seed=3)
    ys, _ = np.nonzero(cv2.cvtColor(shot, cv2.COLOR_BGR2GRAY) > 120)
    shot[: ys.min() + int(0.03 * (ys.max() - ys.min()))] = 235   # 윗변 테두리가 밝은 배경에 묻힘
    cands = candidates(slide, [RID, *DECOYS])
    assert not detect(shot, KEY, cands)["found"]                 # 테두리 검출만으로는 실패
    r = detect(shot, KEY, cands, references=[strip_frame(issued)])
    assert r["alignment"] == "reference" and r["found"] and r["recipient_id"] == RID


def test_coherent_no_false_positive_with_reference(flat_slide):
    """워터마크 없는 문서를 원본 대조로 정렬해도 정보 결합 검출이 오탐하지 않음."""
    clean = add_frame(flat_slide)
    cands = candidates(flat_slide, [RID, *DECOYS])
    for angle in (0, 20):
        r = detect(capture(clean, angle, seed=angle), KEY, cands, references=[strip_frame(clean)])
        assert not r["found"]


def test_coherent_detects_legacy_v1_copy(flat_slide):
    """구버전(v1: 대역 0.10~0.35, 마스크 하한 0.4, 강도 3) 배포본도 원본 대조 시 검출."""
    import watermark.embed as E
    from watermark.utils import PARAM_SETS, texture_mask
    v1 = PARAM_SETS["v1"]
    orig = E.texture_mask
    E.texture_mask = lambda y, **kw: texture_mask(y, lo=v1["lo"])
    try:
        wm, _ = embed(flat_slide, RID, KEY, 3.0, band=v1["band"])
    finally:
        E.texture_mask = orig
    issued = add_frame(wm)
    r = detect(capture(issued, 20, seed=4), KEY, candidates(flat_slide, [RID, *DECOYS]), references=[strip_frame(issued)])
    assert r["found"] and r["recipient_id"] == RID and r["via"] == "coherent" and r["version"] == "v1"


def test_no_false_positive_on_clean_capture(sample):
    r = detect(capture(add_frame(sample), 15), KEY, candidates(sample, [RID, *DECOYS]))
    assert not r["found"]


def test_wrong_key_finds_nothing(sample):
    wm, _ = embed(sample, RID, KEY)
    r = detect(capture(add_frame(wm), 0), "other-key", candidates(sample, [RID, *DECOYS]))
    assert not r["found"]


def test_server_embed_and_detect(sample):
    import server
    c = server.app.test_client()
    assert c.get("/health").json == {"status": "ok"}

    e = c.post("/v1/embed", data={"recipientId": RID}).json
    png = cv2.imdecode(np.frombuffer(base64.b64decode(e["imagePng"]), np.uint8), cv2.IMREAD_COLOR)
    assert png.shape[:2] == (e["height"] + 2 * e["frame"], e["width"] + 2 * e["frame"])

    _, jpg = cv2.imencode(".jpg", capture(png, 15))
    cands = [dict(id=i, width=e["width"], height=e["height"]) for i in [RID, *DECOYS]]
    d = c.post("/v1/detect", data={"photo": (io.BytesIO(jpg.tobytes()), "p.jpg"), "candidates": json.dumps(cands)},
               content_type="multipart/form-data").json
    assert d["found"] and d["recipientId"] == RID
    assert e["predictedZ"] >= 5 and 3.0 <= e["strength"] <= 5.0


def test_server_rejects_bad_input():
    import server
    c = server.app.test_client()
    assert c.post("/v1/embed", data={}).status_code == 400
    assert c.post("/v1/embed", data={"recipientId": 2 ** 32}).status_code == 400
    assert c.post("/v1/detect", data={}).status_code == 400
