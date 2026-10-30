"""TraceGuard 백엔드. 실행: uvicorn main:app --port 8000 (poc/backend 에서)"""
import base64
import logging

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

import hck_service as svc
import hck_store as store
from sample_doc import SAMPLE_PATH, make_sample_doc

log = logging.getLogger("traceguard")
app = FastAPI(title="TraceGuard PoC")
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


@app.exception_handler(svc.BadFile)
async def bad_file(_: Request, e: svc.BadFile):
    return JSONResponse({"detail": str(e)}, status_code=400)


@app.exception_handler(PermissionError)
async def denied(_: Request, e: PermissionError):
    return JSONResponse({"detail": str(e)}, status_code=403)


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read(svc.MAX_UPLOAD + 1)
    if len(data) > svc.MAX_UPLOAD:
        raise HTTPException(413, "파일이 너무 큽니다. (최대 25MB)")
    return data


def require_demo(request: Request):
    if not svc.DEMO_MODE:
        raise HTTPException(404, "데모 모드가 꺼져 있습니다.")
    # 단순 POST 는 CORS 사전 확인이 없어서, 다른 사이트에서 보낸 요청을 여기서 막는다
    if request.headers.get("origin", ALLOWED_ORIGINS[0]) not in ALLOWED_ORIGINS:
        raise HTTPException(403, "허용되지 않은 출처입니다.")


def hck_response(data: bytes, filename: str) -> Response:
    return Response(data, media_type="application/x-hck",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/api/hck/create")
async def create(image: UploadFile = File(...), actor: str = Form(...), title: str = Form(...)):
    creator = svc.resolve_actor(actor)
    if creator["org"] == "외부":
        raise svc.BadFile("문서 등록은 사내 계정만 할 수 있습니다.")
    data, doc_id = svc.create_document(await read_upload(image), svc.clean_title(title), creator)
    response = hck_response(data, f"{doc_id}.hck")
    response.headers["X-Doc-Id"] = doc_id
    return response


@app.post("/api/hck/open")
async def open_hck(file: UploadFile = File(...), actor: str = Form(...)):
    opened = svc.open_document(await read_upload(file), svc.resolve_actor(actor))
    return {"hck_b64": base64.b64encode(opened["file"]).decode(), "image_b64": base64.b64encode(opened["image"]).decode(),
            "image_mime": opened["mime"], "parent": opened["parent"], "ledger": opened["ledger"],
            "title": opened["title"], "doc_id": opened["doc_id"]}


@app.post("/api/trace")
async def trace(file: UploadFile = File(...)):
    return svc.build_trace(await read_upload(file))


@app.get("/api/overview")
def overview():
    return {**store.stats(), "demo_mode": svc.DEMO_MODE,
            "recent": [{"title": r.get("title"), "event": r["event"], "actor": svc._public_actor(r["actor"]),
                        "external": svc._is_external(r["actor"]), "at_kst": svc.kst_text(r["at"])}
                       for r in store.recent_logs()]}


@app.get("/api/docs-list")
def docs():
    return [{**d, "created_at_kst": svc.kst_text(d["created_at"]) if d["created_at"] else None,
             "created_by": svc._public_actor(d["created_by"])} for d in store.list_documents()]


@app.get("/api/docs-list/{doc_id}/tree")
def tree(doc_id: str):
    if store.get_document(doc_id) is None:
        raise HTTPException(404, "없는 문서입니다.")
    return svc.server_tree(doc_id)


@app.get("/api/demo/sample-image")
def sample_image(request: Request):
    require_demo(request)
    if not SAMPLE_PATH.exists():
        import cv2
        SAMPLE_PATH.parent.mkdir(exist_ok=True)
        cv2.imwrite(str(SAMPLE_PATH), make_sample_doc())
    return FileResponse(SAMPLE_PATH, media_type="image/png")


@app.post("/api/demo/wipe-logs")
def wipe_logs(request: Request):
    require_demo(request)
    return {"deleted": store.wipe_logs()}


@app.post("/api/demo/restore-logs")
def restore_logs(request: Request):
    require_demo(request)
    return {"restored": store.restore_logs()}


@app.post("/api/demo/tamper")
async def tamper(request: Request, file: UploadFile = File(...)):
    require_demo(request)
    return hck_response(svc.tamper_remove_first_external(await read_upload(file)), "tampered.hck")


@app.post("/api/demo/reset")
def reset(request: Request):
    require_demo(request)
    store.reset_all()
    return {"ok": True}
