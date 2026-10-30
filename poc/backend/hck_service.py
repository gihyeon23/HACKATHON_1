"""tracing/의 hck.py 를 가져와 서버용으로 감싼다. 원본 코드는 고치지 않는다.

hck.py 에 없어서 여기서 막는 것
- 업로드 zip 검사: 이름 3개 고정, 압축 해제 크기 제한, 장부 형식 검사
- 장부 통째 교체: create 줄의 hash 를 서버에 저장해 두고 대조한다
- 장부 끝줄 잘라내기: 파일만으로는 알 수 없어서 서버 로그와 대조해 경고한다
"""
import hashlib
import hmac
import io
import json
import os
import re
import sys
import uuid
import zipfile
import zlib
from datetime import timedelta, timezone, datetime
from pathlib import Path

from cryptography.exceptions import InvalidTag

import hck_store as store

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR.parent.parent / "tracing" / "hck-format" / "scripts"))
import hck  # noqa: E402

MAX_UPLOAD = 25 * 1024 * 1024
MAX_UNPACKED = 40 * 1024 * 1024
MAX_LEDGER = 2 * 1024 * 1024
ZIP_NAMES = {"manifest.json", "payload.enc", "ledger.json"}
ENTRY_FIELDS = ("seq", "event", "actor", "at", "parent_hash", "hash", "sig")
KST = timezone(timedelta(hours=9))

INTERNAL = {
    "A": {"id": "A", "name": "김OO", "org": "설계팀(사내)"},
    "B": {"id": "B", "name": "박OO", "org": "설계팀(사내)"},
    "S": {"id": "S", "name": "보안팀", "org": "보안팀(사내)"},
}


class BadFile(ValueError):
    """.hck 형식이 아니거나 입력값이 잘못된 경우 → 400"""


def _env_value(name: str):
    value = os.environ.get(name)
    env_file = BACKEND_DIR / ".env"
    if value is None and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith(f"{name}="):
                value = line.split("=", 1)[1].strip()
    return value


_secret = _env_value("HCK_SERVER_SECRET")
if not _secret:
    raise RuntimeError("HCK_SERVER_SECRET 이 없습니다. poc/backend/.env 에 넣어 주세요.")
hck.SERVER_SECRET = _secret.encode()
hck.KEY_STORE = store.SqliteKeyStore()
DEMO_MODE = _env_value("HCK_DEMO") == "1"


# ------------------------------------------------------------------ 입력 검사
def image_mime(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise BadFile("PNG 또는 JPG 이미지만 등록할 수 있습니다.")


def _clean_text(value, limit: int, label: str) -> str:
    text = str(value or "").strip()
    if not text or len(text) > limit or re.search(r"[<>\x00-\x1f]", text):
        raise BadFile(f"{label} 값이 올바르지 않습니다.")
    return text


def clean_title(value) -> str:
    return _clean_text(value, 80, "문서 제목")


def resolve_actor(raw: str) -> dict:
    """소속은 클라이언트 값을 쓰지 않는다. 사내는 계정표에서, 외부는 서버가 '외부'로 고정한다.
    TODO: PoC 라 본인 인증이 없다. 실서비스는 사내 SSO 와 휴대폰 본인인증이 필요하다."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        raise BadFile("열람자 정보가 올바르지 않습니다.")
    if not isinstance(data, dict) or len(raw) > 1000:
        raise BadFile("열람자 정보가 올바르지 않습니다.")
    device = str(data.get("device") or "")
    device = device if re.fullmatch(r"[\w .:/-]{1,40}", device) else "미상"

    if data.get("kind") == "internal":
        account = INTERNAL.get(data.get("id"))
        if account is None:
            raise BadFile("없는 사내 계정입니다.")
        return {**account, "device": device}

    name = _clean_text(data.get("name"), 20, "이름")
    digits = re.sub(r"\D", "", str(data.get("phone") or ""))
    if not re.fullmatch(r"01\d{8,9}", digits):
        raise BadFile("전화번호를 010-1234-5678 형식으로 입력해 주세요.")
    # 장부는 평문이라, 솔트 없는 해시면 가운데 4자리를 대입해 전화번호가 복원된다
    person = hmac.new(hck.SERVER_SECRET, f"{name}|{digits}".encode(), hashlib.sha256).hexdigest()[:16]
    return {"id": f"X-{person}", "name": name, "org": "외부",
            "phone": f"{digits[:3]}-****-{digits[-4:]}", "device": device}


def parse_hck(data: bytes):
    """hck.unpack 앞단의 안전 검사. (manifest, payload, ledger) 를 돌려준다."""
    if len(data) > MAX_UPLOAD:
        raise BadFile("파일이 너무 큽니다.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            if len(infos) != 3 or {i.filename for i in infos} != ZIP_NAMES:
                raise BadFile(".hck 파일 구조가 아닙니다.")
            if sum(i.file_size for i in infos) > MAX_UNPACKED or z.getinfo("ledger.json").file_size > MAX_LEDGER:
                raise BadFile("압축을 풀었을 때 크기가 너무 큽니다.")
        manifest, payload, ledger = hck.unpack(data)
    except (zipfile.BadZipFile, ValueError, KeyError, RuntimeError, EOFError,
            AttributeError, TypeError, zlib.error) as e:
        if isinstance(e, BadFile):
            raise
        raise BadFile(".hck 파일이 아니거나 손상되었습니다.")
    if not isinstance(manifest.get("doc_id"), str) or not isinstance(manifest.get("title"), str) \
            or not isinstance(ledger, list) or not ledger:
        raise BadFile(".hck 장부가 비어 있거나 손상되었습니다.")
    if not all(_entry_ok(e) for e in ledger):
        raise BadFile(".hck 장부 형식이 잘못되었습니다(변조 의심).")
    return manifest, payload, ledger


def _entry_ok(e) -> bool:
    if not isinstance(e, dict) or any(k not in e for k in ENTRY_FIELDS):
        return False
    actor = e["actor"]
    if not isinstance(e["seq"], int) or isinstance(e["seq"], bool) or not isinstance(actor, dict):
        return False
    if not all(isinstance(e[k], str) for k in ("event", "at", "parent_hash", "hash", "sig")):
        return False
    if not re.fullmatch(r"[0-9a-f]{64}", e["hash"]) or not re.fullmatch(r"[0-9a-f]{64}", e["sig"]):
        return False
    if not all(isinstance(actor.get(k), str) and 0 < len(actor[k]) <= 80 for k in ("id", "name", "org")):
        return False
    if not all(isinstance(actor.get(k, ""), str) and len(actor.get(k, "")) <= 80 for k in ("phone", "device")):
        return False
    try:
        kst_text(e["at"])
    except (ValueError, TypeError):
        return False
    return True


def _genesis_problem(manifest: dict, ledger: list):
    doc = store.get_document(manifest["doc_id"])
    if doc and doc["genesis_hash"] != ledger[0]["hash"]:
        return {"ok": False, "broken_at": 0, "reasons": ["이 문서의 장부가 아님(다른 문서 장부로 교체 의심)"]}
    return None


# ------------------------------------------------------------------ 서버 동작
def create_document(image: bytes, title: str, creator: dict) -> tuple[bytes, str]:
    image_mime(image)
    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    data = hck.create(image, doc_id, title, creator)
    manifest, _, ledger = hck.unpack(data)
    store.save_document(doc_id, title, ledger[0]["hash"], creator, manifest["created_at"])
    store.append_log(doc_id, ledger[0])
    return data, doc_id


def open_document(data: bytes, actor: dict) -> dict:
    manifest, _, ledger = parse_hck(data)
    problem = _genesis_problem(manifest, ledger)
    if problem:
        raise PermissionError(problem["reasons"][0])
    verdict = hck.verify_ledger(ledger)
    if not verdict["ok"]:
        raise PermissionError(f"장부 검증 실패: {verdict['reasons'][0]}")
    try:
        new_file, image, parent = hck.open_file(data, actor)
    except InvalidTag:
        raise PermissionError("문서 내용을 복호화할 수 없습니다(파일 변조 의심).")
    new_ledger = hck.unpack(new_file)[2]
    store.append_log(manifest["doc_id"], new_ledger[-1])
    return {"file": new_file, "image": image, "mime": image_mime(image), "parent": _public_entry(parent),
            "ledger": [_public_entry(e) for e in new_ledger], "title": _title(manifest), "doc_id": manifest["doc_id"]}


def tamper_remove_first_external(data: bytes) -> bytes:
    """데모: 파일 장부에서 첫 외부인 줄을 지운 조작본을 만든다."""
    manifest, payload, ledger = parse_hck(data)
    target = next((e for e in ledger if "외부" in e["actor"].get("org", "")), None)
    if target is None:
        raise BadFile("지울 외부인 기록이 없습니다.")
    kept = [dict(e) for e in ledger if e["actor"].get("id") != target["actor"].get("id")]
    for i, e in enumerate(kept):
        e["seq"] = i
    return hck.pack(manifest, payload, kept)


# ------------------------------------------------------------------ 추적
def kst_text(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(KST).strftime("%Y-%m-%d %H:%M:%S")


def _title(manifest: dict) -> str:
    doc = store.get_document(manifest["doc_id"])
    return doc["title"] if doc and doc["title"] else manifest.get("title", "(제목 없음)")


def _public_actor(a: dict) -> dict:
    return {k: a.get(k) for k in ("id", "name", "org", "phone", "device") if a.get(k)}


def _public_entry(e: dict) -> dict:
    return {"seq": e["seq"], "event": e["event"], "actor": _public_actor(e["actor"]), "at": e["at"],
            "at_kst": kst_text(e["at"]), "hash": e["hash"][:12]}


def _is_external(actor: dict) -> bool:
    return "외부" in actor.get("org", "")


def server_tree(doc_id: str, file_hashes: set | None = None) -> dict:
    """서버 로그를 부모 hash 로 이어 트리로 만든다. 한 사본을 두 사람이 열면 가지가 갈라진다."""
    rows = store.logs_for(doc_id)
    file_hashes = file_hashes or set()
    children: dict = {}
    for r in rows:
        children.setdefault(r["parent_hash"], []).append(r)

    def node(r):
        return {"hash": r["hash"][:12], "actor": _public_actor(r["actor"]), "event": r["event"], "at": r["at"],
                "at_kst": kst_text(r["at"]), "in_file": r["hash"] in file_hashes,
                "children": [node(c) for c in children.get(r["hash"], [])]}

    return {"rows": len(rows), "roots": [node(r) for r in children.get("GENESIS", [])],
            "branch_points": sum(len(v) > 1 for v in children.values())}


def _descendants(start: str, rows: list[dict]) -> list[dict]:
    found, frontier = [], {start}
    while frontier:
        batch = [r for r in rows if r["parent_hash"] in frontier]
        found += batch
        frontier = {r["hash"] for r in batch}
    return found


def build_trace(data: bytes) -> dict:
    manifest, _, ledger = parse_hck(data)
    doc_id = manifest["doc_id"]
    result = hck.trace(data)
    problem = _genesis_problem(manifest, ledger)
    if problem:
        result["integrity"], result["path"] = problem, []
    integrity = result["integrity"]
    trusted_count = len(ledger) if integrity["ok"] else integrity["broken_at"]

    rows = store.logs_for(doc_id)
    logged = {r["hash"][:12] for r in rows}
    file_hashes = {e["hash"] for e in ledger[:trusted_count]}

    path, first_external = [], None
    for n in result["path"]:
        actor = _public_actor(n["actor"])
        external = _is_external(actor)
        if external and path and not path[-1]["external"] and first_external is None:
            parent_hash = next(e["parent_hash"] for e in ledger if e["hash"].startswith(n["hash"]))
            first_external = {"from": path[-1]["actor"]["name"], "to": actor["name"], "at_kst": kst_text(n["at"]),
                              "branched": sum(r["parent_hash"] == parent_hash for r in rows) > 1}
        path.append({"actor": actor, "external": external, "event": n["event"], "at": n["at"],
                     "at_kst": kst_text(n["at"]), "hash": n["hash"], "signature_ok": True,
                     "reopened_kst": [kst_text(t) for t in n["reopened"]],
                     "log_match": n["hash"] in logged})

    after_file = _descendants(ledger[trusted_count - 1]["hash"], rows) if trusted_count else []
    if not rows:
        log_state = "empty"
    elif path and all(p["log_match"] for p in path):
        log_state = "match"
    else:
        log_state = "mismatch"

    return {
        "doc_id": doc_id, "title": _title(manifest), "registered": store.get_document(doc_id) is not None,
        "integrity": integrity, "path": path, "first_external": first_external,
        "last_holder": path[-1]["actor"] if path else None,
        "ledger_lines": len(ledger), "trusted_lines": trusted_count,
        "untrusted": [_public_entry(e) for e in ledger[trusted_count:]],
        "nodes": [{"id": "n%d" % i, "label": p["actor"]["name"], "time": p["at_kst"]} for i, p in enumerate(path)],
        "edges": [["n%d" % i, "n%d" % (i + 1)] for i in range(len(path) - 1)],
        "server_log": {"state": log_state, "rows": len(rows), "after_file": [_public_entry({**r, "sig": ""}) for r in after_file],
                       "tree": server_tree(doc_id, file_hashes)},
    }
