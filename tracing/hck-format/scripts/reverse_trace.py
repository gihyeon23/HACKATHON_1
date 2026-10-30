"""
역추적: 밖에서 발견된 .hck 파일 하나로 "지금 가진 사람 → … → 원본 작성자"를 거슬러 올라간다.
서버·브라우저·키가 없어도 동작한다 (장부 서명 검증에는 서버 비밀값만 필요).

  .venv/bin/python tracing/hck-format/scripts/reverse_trace.py poc/backend/demo/found_D.hck
  .venv/bin/python tracing/hck-format/scripts/reverse_trace.py demo/            # 폴더 안 .hck 전부
  .venv/bin/python tracing/hck-format/scripts/reverse_trace.py found.hck --json # 대시보드·보고서용 JSON

서버 비밀값: 환경변수 HCK_SERVER_SECRET → 없으면 poc/backend/.env → 없으면 시연용 기본값
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
KST = timezone(timedelta(hours=9))


def _load_secret():
    if os.environ.get("HCK_SERVER_SECRET"):
        return
    env = os.path.join(ROOT, "poc", "backend", ".env")
    if os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("HCK_SERVER_SECRET="):
                os.environ["HCK_SERVER_SECRET"] = line.split("=", 1)[1].strip().strip('"').strip("'")


_load_secret()
sys.path.insert(0, HERE)
import hck  # noqa: E402  (비밀값을 먼저 넣은 뒤 import)


def is_external(actor):
    return "외부" in actor.get("org", "")


def reverse_trace(data: bytes) -> dict:
    t = hck.trace(data)
    path = t["path"]
    hops = []
    for i in range(len(path) - 1, -1, -1):  # 마지막 보유자부터 거꾸로
        cur = path[i]
        parent = path[i - 1] if i > 0 else None
        hops.append({
            "step": len(path) - 1 - i,
            "who": cur["actor"]["name"],
            "org": cur["actor"].get("org", ""),
            "device": cur["actor"].get("device", ""),
            "phone": cur["actor"].get("phone"),
            "opened_at_kst": datetime.fromisoformat(cur["at"]).astimezone(KST).strftime("%Y-%m-%d %H:%M:%S"),
            "received_from": parent["actor"]["name"] if parent else None,
            "is_origin": parent is None,
            "is_first_external": bool(parent and is_external(cur["actor"]) and not is_external(parent["actor"])),
        })
    first_ext = next((h for h in hops if h["is_first_external"]), None)
    return {
        "document": t["title"], "doc_id": t["doc_id"],
        "integrity_ok": t["integrity"]["ok"], "integrity": t["integrity"],
        "current_holder": hops[0]["who"] if hops else None,
        "origin": hops[-1]["who"] if hops else None,
        "first_external_leak": {"from": first_ext["received_from"], "to": first_ext["who"], "at_kst": first_ext["opened_at_kst"]} if first_ext else None,
        "reverse_path": hops,
        "forward_path": " → ".join(h["who"] for h in reversed(hops)),
    }


def print_report(name, r):
    R, G, Y, D, X = "\033[91m", "\033[92m", "\033[93m", "\033[2m", "\033[0m"
    print(f"\n{Y}■ 역추적: {name}{X}   문서: {r['document']} ({r['doc_id']})")
    if r["integrity_ok"]:
        print(f"  장부 서명 검증: {G}✅ 정상{X}")
    else:
        print(f"  장부 서명 검증: {R}❌ 조작 감지 — {r['integrity']['broken_at']}번째 기록부터 신뢰 불가 {r['integrity']['reasons']}{X}")
        print(f"  {D}(깨지기 전까지의 기록만으로 역추적합니다){X}")
    for h in r["reverse_path"]:
        color = R if "외부" in h["org"] else G
        tag = "현재 보유자" if h["step"] == 0 else ("원본 작성자" if h["is_origin"] else "")
        print(f"  {color}{h['who']} ({h['org']}){X}  {h['opened_at_kst']} KST  {D}{h['device']}{X}  {tag}")
        if h["received_from"]:
            leak = f"  {R}🔴 최초 외부 유출 지점{X}" if h["is_first_external"] else ""
            print(f"     ↑ {h['received_from']}에게서 받음{leak}")
    if r["first_external_leak"]:
        f = r["first_external_leak"]
        print(f"\n  결론: {f['from']} → {f['to']} 에서 처음 회사 밖으로 나갔다 ({f['at_kst']} KST 외부 첫 열람)")
    print(f"  전체 경로: {r['forward_path']}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    if not args:
        sys.exit(__doc__)
    targets = []
    for a in args:
        if os.path.isdir(a):
            targets += sorted(os.path.join(a, f) for f in os.listdir(a) if f.endswith(".hck"))
        else:
            targets.append(a)
    results = {}
    for p in targets:
        try:
            results[p] = reverse_trace(open(p, "rb").read())
            if not as_json:
                print_report(os.path.basename(p), results[p])
        except Exception as e:  # 형식 오류 등
            results[p] = {"error": str(e)}
            if not as_json:
                print(f"\n■ {p}: 읽을 수 없음 — {e}")
    if as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
