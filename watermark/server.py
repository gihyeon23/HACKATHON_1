"""워터마크 엔진 REST API (stateless). 백엔드(Spring Boot)가 호출.

엔진은 이름·대장·파일을 저장하지 않음. 수신자는 32bit ID로만 다룸.
API 계약: API.md

실행 (watermark/ 에서)
  WM_KEY=<비밀키> python server.py          → http://127.0.0.1:8000
"""
from __future__ import annotations

import base64
import json
import os
import time

import cv2
import numpy as np
from flask import Flask, jsonify, request

from watermark.detect import Z_THRESH, detect
from watermark.embed import FRAME, add_frame, embed, embed_auto, predict_z, strip_frame
from watermark.utils import limit_size, make_sample, psnr, ssim, to_gray

KEY = os.environ.get("WM_KEY", "poc-secret-key")
MAX_REFERENCES = 10

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 30 * 1024 * 1024


class BadRequest(Exception):
    pass


@app.errorhandler(BadRequest)
def bad_request(e):
    return jsonify(error=str(e)), 400


def read_image(field: str, required: bool) -> np.ndarray | None:
    f = request.files.get(field)
    if not f or not f.filename:
        if required:
            raise BadRequest(f"'{field}' 파일이 필요합니다")
        return None
    img = cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise BadRequest(f"'{field}' 이미지를 읽을 수 없습니다")
    return img


def b64(img: np.ndarray, ext: str = ".png", max_side: int | None = None) -> str:
    img = limit_size(img, max_side) if max_side else img
    _, buf = cv2.imencode(ext, img)
    return base64.b64encode(buf).decode()


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/v1/embed")
def api_embed():
    try:
        rid = int(request.form["recipientId"])
    except (KeyError, ValueError):
        raise BadRequest("'recipientId'(정수)가 필요합니다")
    if not 0 <= rid < 2 ** 32:
        raise BadRequest("'recipientId'는 0 ~ 2^32-1")
    try:
        strength = float(request.form["strength"]) if request.form.get("strength") else None   # 없으면 자동
    except ValueError:
        raise BadRequest("'strength'는 숫자")
    img = read_image("image", required=False)
    img = limit_size(img if img is not None else make_sample(), int(request.form.get("maxSide", 1600)))

    t0 = time.perf_counter()
    if strength is None:
        wm, info = embed_auto(img, rid, KEY)
    else:
        wm, info = embed(img, rid, KEY, strength)
        info.update(strength=strength, predicted_z=predict_z(add_frame(wm), rid, KEY))
    ms = (time.perf_counter() - t0) * 1000
    g0, g1 = to_gray(img), to_gray(wm)
    return jsonify(recipientId=rid, width=img.shape[1], height=img.shape[0], frame=FRAME,
                   strength=info["strength"], predictedZ=round(info["predicted_z"], 2), threshold=Z_THRESH,
                   psnr=round(psnr(g0, g1), 2), ssim=round(ssim(g0, g1), 4), elapsedMs=round(ms, 1),
                   imagePng=b64(add_frame(wm)))


@app.post("/v1/detect")
def api_detect():
    photo = read_image("photo", required=True)
    try:
        cands = json.loads(request.form.get("candidates", "[]"))
        cands = [dict(id=int(c["id"]), size=[int(c["width"]), int(c["height"])]) for c in cands]
    except (ValueError, KeyError, TypeError):
        raise BadRequest("'candidates'는 [{\"id\":int,\"width\":int,\"height\":int}] JSON")
    corners = None
    if request.form.get("corners", "").strip():
        try:
            corners = np.array(request.form["corners"].split(","), np.float32).reshape(4, 2)
        except ValueError:
            raise BadRequest("'corners'는 숫자 8개 (x1,y1,...,x4,y4)")

    refs = []
    for f in request.files.getlist("reference")[:MAX_REFERENCES]:     # 배포본 PNG (테두리 포함)
        ref = cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)
        if ref is None:
            raise BadRequest("'reference' 이미지를 읽을 수 없습니다")
        refs.append(strip_frame(ref))

    t0 = time.perf_counter()
    r = detect(photo, KEY, cands, corners, references=refs)
    ms = (time.perf_counter() - t0) * 1000
    if r.get("error"):
        return jsonify(found=False, error=r["error"], elapsedMs=round(ms, 1))
    return jsonify(found=r["found"], recipientId=r["recipient_id"], via=r["via"], alignment=r["alignment"],
                   version=r.get("version"),
                   z=round(r["z"], 2), z2=round(r["z2"], 2), threshold=Z_THRESH,
                   ranking=[dict(id=e["id"], z=round(e["z"], 2)) for e in r["ranking"][:5]],
                   corners=None if r["corners"] is None else np.asarray(r["corners"]).round(1).tolist(),
                   scale=r["scale"], elapsedMs=round(ms, 1),
                   restoredJpeg=b64(r["restored"], ".jpg", 1200))


if __name__ == "__main__":
    # 컨테이너에서는 HOST=0.0.0.0 (Dockerfile). 호스트에서 직접 실행할 때는 기본값대로 로컬에서만 받는다
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 8000)), threaded=True)
