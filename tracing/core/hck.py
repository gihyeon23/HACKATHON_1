"""
.hck — 경로를 스스로 기억하는 보호 파일 형식 (해커톤 PoC)

구조 (zip 컨테이너)
  manifest.json   문서 정보 (doc_id, 제목, 작성자, 생성 시각, 형식 버전)
  payload.enc     AES-256-GCM으로 암호화된 원본 이미지 (키는 서버만 보관)
  ledger.json     이동 장부: 이 사본이 지금까지 누구 손을 거쳤는지 (해시 체인 + 서버 서명)

규칙
- 내용을 보려면 반드시 서버에 "열람 요청"을 해야 한다 → 서버가 신원·시각을 장부에 한 줄 추가하고
  그 줄에 서버 HMAC 서명을 붙인 뒤 복호화된 이미지를 준다. 뷰어는 새 장부로 파일을 다시 저장한다.
- 그래서 B → C → D로 파일이 카톡·USB 등 어떤 경로로 넘어가도, 각자 여는 순간 장부에 기록된다.
- 장부 한 줄: seq, event(create/open), actor, at(초 단위 UTC), parent_hash, hash, sig
  hash = SHA256(parent_hash + 정렬된 본문 JSON),  sig = HMAC-SHA256(SERVER_SECRET, hash)
  → 클라이언트는 서버 비밀키가 없어서 줄을 위조·삭제·순서 변경할 수 없다(검증에서 바로 걸림).

CLI 예시
  python hck.py create  --img doc.png --out a.hck --doc Q4 --title "Q4 설계도" --actor '{"id":"A","name":"김OO","org":"설계팀"}'
  python hck.py open    --in a.hck --out b.hck --img-out seen_b.png --actor '{"id":"B","name":"박OO","org":"설계팀"}'
  python hck.py trace   --in d.hck
  python hck.py demo    # A→B→C→D 전체 시나리오 자동 실행 + 위조 탐지 테스트
"""
import argparse
import hashlib
import hmac
import io
import json
import os
import sys
import zipfile
from datetime import datetime, timezone

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

FORMAT_VERSION = 1
SERVER_SECRET = os.environ.get("HCK_SERVER_SECRET", "dev-only-change-me").encode()
KEY_FILE = os.environ.get("HCK_KEY_FILE", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".hck_keys.json"))
KEY_STORE = {}  # doc_id -> AES 키 (실서비스에서는 서버 DB/KMS). CLI 시연용으로 KEY_FILE에도 저장


def _load_keys():
    if os.path.exists(KEY_FILE):
        KEY_STORE.update({k: bytes.fromhex(v) for k, v in json.load(open(KEY_FILE)).items()})


def _save_keys():
    json.dump({k: v.hex() for k, v in KEY_STORE.items()}, open(KEY_FILE, "w"))


# ------------------------------------------------------------------ 시간·해시
def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _canon(d: dict) -> str:
    return json.dumps(d, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _entry_hash(parent_hash: str, body: dict) -> str:
    return hashlib.sha256((parent_hash + _canon(body)).encode()).hexdigest()


def _sign(h: str) -> str:
    return hmac.new(SERVER_SECRET, h.encode(), hashlib.sha256).hexdigest()


def make_entry(ledger: list, event: str, actor: dict, at: str = None) -> dict:
    """서버에서만 호출되는 함수 (서버 비밀키 사용)."""
    parent = ledger[-1]["hash"] if ledger else "GENESIS"
    body = {"seq": len(ledger), "event": event, "actor": actor, "at": at or now_iso(), "parent_hash": parent}
    h = _entry_hash(parent, body)
    return {**body, "hash": h, "sig": _sign(h)}


# ------------------------------------------------------------------ 검증
def verify_ledger(ledger: list) -> dict:
    """장부 무결성 검사. 어디서 깨졌는지까지 알려준다."""
    parent = "GENESIS"
    for i, e in enumerate(ledger):
        body = {k: e[k] for k in ("seq", "event", "actor", "at", "parent_hash")}
        problems = []
        if e["seq"] != i:
            problems.append("순서 번호 불일치")
        if e["parent_hash"] != parent:
            problems.append("앞 기록과 연결 끊김(삭제·순서 변경 의심)")
        if _entry_hash(parent, body) != e["hash"]:
            problems.append("내용이 바뀜(위조 의심)")
        if not hmac.compare_digest(_sign(e["hash"]), e["sig"]):
            problems.append("서버 서명 불일치(외부에서 만든 기록)")
        if problems:
            return {"ok": False, "broken_at": i, "reasons": problems}
        parent = e["hash"]
    return {"ok": True, "broken_at": None, "reasons": []}


# ------------------------------------------------------------------ 파일 입출력
def pack(manifest: dict, payload_enc: bytes, ledger: list) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", _canon(manifest))
        z.writestr("payload.enc", payload_enc)
        z.writestr("ledger.json", json.dumps(ledger, ensure_ascii=False, indent=1))
    return buf.getvalue()


def unpack(data: bytes):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        manifest = json.loads(z.read("manifest.json"))
        payload = z.read("payload.enc")
        ledger = json.loads(z.read("ledger.json"))
    if manifest.get("format") != "hck":
        raise ValueError(".hck 파일이 아님")
    return manifest, payload, ledger


# ------------------------------------------------------------------ 서버 동작
def create(image_bytes: bytes, doc_id: str, title: str, creator: dict, at: str = None) -> bytes:
    key = AESGCM.generate_key(bit_length=256)
    KEY_STORE[doc_id] = key
    nonce = os.urandom(12)
    enc = nonce + AESGCM(key).encrypt(nonce, image_bytes, doc_id.encode())
    manifest = {"format": "hck", "version": FORMAT_VERSION, "doc_id": doc_id, "title": title,
                "created_by": creator, "created_at": at or now_iso()}
    ledger = [make_entry([], "create", creator, manifest["created_at"])]
    return pack(manifest, enc, ledger)


def open_file(hck_bytes: bytes, actor: dict, at: str = None):
    """열람 요청 처리: 장부 검증 → 새 줄 추가 → (새 .hck, 복호화 이미지, 부모 기록) 반환.
    장부가 깨져 있으면 열어주지 않는다."""
    manifest, payload, ledger = unpack(hck_bytes)
    v = verify_ledger(ledger)
    if not v["ok"]:
        raise PermissionError(f"장부 검증 실패: {v}")
    key = KEY_STORE.get(manifest["doc_id"])
    if key is None:
        raise PermissionError("서버에 키가 없음 (회수·만료된 문서)")
    image = AESGCM(key).decrypt(payload[:12], payload[12:], manifest["doc_id"].encode())
    parent = ledger[-1]
    ledger = ledger + [make_entry(ledger, "open", actor, at)]
    return pack(manifest, payload, ledger), image, parent


def trace(hck_bytes: bytes) -> dict:
    """발견된 .hck 한 개에서 경로·시간 복원 (서버 로그 없이도 동작)."""
    manifest, _, ledger = unpack(hck_bytes)
    v = verify_ledger(ledger)
    trusted = ledger if v["ok"] else ledger[: v["broken_at"]]
    path = []
    for e in trusted:
        a = e["actor"]
        if path and path[-1]["actor"].get("id") == a.get("id"):
            path[-1]["reopened"].append(e["at"])  # 같은 사람이 다시 연 기록은 한 노드로 묶음
            continue
        path.append({"actor": a, "event": e["event"], "at": e["at"], "hash": e["hash"][:12], "reopened": []})
    return {"doc_id": manifest["doc_id"], "title": manifest["title"], "integrity": v,
            "path": path, "last_holder": path[-1]["actor"] if path else None}


# ------------------------------------------------------------------ 데모
def demo():
    import tempfile
    img = b"\x89PNG-fake-image-bytes-for-demo" * 50
    people = {
        "A": {"id": "A", "name": "김OO", "org": "설계팀(사내)", "device": "LAPTOP-A1"},
        "B": {"id": "B", "name": "박OO", "org": "설계팀(사내)", "device": "LAPTOP-B7"},
        "C": {"id": "C", "name": "이OO", "org": "외부", "phone": "010-****-1234", "device": "MAC-C3"},
        "D": {"id": "D", "name": "최OO", "org": "외부", "phone": "010-****-5678", "device": "PC-D9"},
    }
    a = create(img, "Q4-DESIGN", "Q4 신제품 설계도", people["A"], "2026-10-31T03:12:07+00:00")
    b, seen, _ = open_file(a, people["B"], "2026-10-31T03:42:31+00:00")   # A가 사내 공유 → B 열람
    c, _, par_c = open_file(b, people["C"], "2026-10-31T04:07:55+00:00")  # B가 카톡으로 C에게 유출
    d, _, par_d = open_file(c, people["D"], "2026-10-31T04:31:10+00:00")  # C가 USB로 D에게 유출
    assert seen == img
    t = trace(d)
    print("■ 경로 복원 (D가 가진 파일 하나로)")
    print("  " + " → ".join(f'{p["actor"]["name"]}({p["at"][11:19]})' for p in t["path"]))
    print("  무결성:", t["integrity"])
    assert [p["actor"]["id"] for p in t["path"]] == ["A", "B", "C", "D"]
    print("  C의 부모:", par_c["actor"]["name"], "/ D의 부모:", par_d["actor"]["name"])

    print("\n■ 위조 테스트")
    m, p, led = unpack(d)
    led2 = [e for e in led if e["actor"]["id"] != "C"]  # C 기록 삭제 시도
    for i, e in enumerate(led2):
        e["seq"] = i
    print("  C 기록 삭제 →", verify_ledger(led2)["reasons"])
    led3 = json.loads(json.dumps(led)); led3[1]["actor"]["name"] = "누군가"
    print("  B 이름 바꿔치기 →", verify_ledger(led3)["reasons"])
    led4 = json.loads(json.dumps(led)); fake = dict(led4[-1]); fake["seq"] += 1; led4.append(fake)
    print("  가짜 기록 추가 →", verify_ledger(led4)["reasons"])
    try:
        open_file(pack(m, p, led2), people["D"])
    except PermissionError as e:
        print("  깨진 파일 열기 →", "거부됨")

    out = os.path.join(tempfile.gettempdir(), "demo_D.hck")
    open(out, "wb").write(d)
    print(f"\n■ D의 파일 저장: {out} ({len(d)} bytes)")


# ------------------------------------------------------------------ CLI
def main():
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest="cmd", required=True)
    c = s.add_parser("create"); c.add_argument("--img", required=True); c.add_argument("--out", required=True)
    c.add_argument("--doc", required=True); c.add_argument("--title", default="문서"); c.add_argument("--actor", required=True)
    o = s.add_parser("open"); o.add_argument("--in", dest="inp", required=True); o.add_argument("--out", required=True)
    o.add_argument("--img-out"); o.add_argument("--actor", required=True)
    t = s.add_parser("trace"); t.add_argument("--in", dest="inp", required=True)
    s.add_parser("demo")
    a = p.parse_args()
    _load_keys()
    if a.cmd == "demo":
        return demo()
    if a.cmd == "create":
        open(a.out, "wb").write(create(open(a.img, "rb").read(), a.doc, a.title, json.loads(a.actor)))
        _save_keys()
        print(f"생성: {a.out}  (키는 {KEY_FILE} 에 저장 — 시연용, 실제 서버에서는 DB)")
    elif a.cmd == "open":
        new, img, parent = open_file(open(a.inp, "rb").read(), json.loads(a.actor))
        open(a.out, "wb").write(new)
        if a.img_out:
            open(a.img_out, "wb").write(img)
        print(f'열람 완료: {json.loads(a.actor)["name"]}  ← {parent["actor"]["name"]}에게서 받은 파일')
    else:
        t = trace(open(a.inp, "rb").read())
        print(f'■ 문서: {t["title"]}   무결성: {"OK" if t["integrity"]["ok"] else "깨짐 " + str(t["integrity"])}')
        prev = None
        for i, n in enumerate(t["path"]):
            a_ = n["actor"]
            kst = datetime.fromisoformat(n["at"]).astimezone(timezone(__import__("datetime").timedelta(hours=9))).strftime("%m-%d %H:%M:%S")
            mark = "  🔴 최초 외부 유출" if prev and "외부" in a_.get("org", "") and "외부" not in prev.get("org", "") else ""
            print(f'  {i}. {a_["name"]} ({a_.get("org","")})  {kst} KST{mark}')
            prev = a_


if __name__ == "__main__":
    main()
