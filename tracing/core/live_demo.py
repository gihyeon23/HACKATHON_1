"""
라이브 시연용: 엔터를 누를 때마다 한 단계씩 진행
  .venv/bin/python tracing/core/live_demo.py [이미지경로]
이미지를 안 주면 tracing/server/demo/sample_blueprint.png 를 원본으로 사용
결과 파일은 demo/live/ 에 생김 (A.hck, B.hck, C.hck, D.hck, B가_본_화면.png)
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hck  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # tracing/
OUT = os.path.join(ROOT, "demo", "live")
KST = timezone(timedelta(hours=9))
R, G, Y, B, D, X = "\033[91m", "\033[92m", "\033[93m", "\033[94m", "\033[2m", "\033[0m"

P = {
    "A": {"id": "A", "name": "김OO", "org": "설계팀(사내)", "device": "LAPTOP-A1"},
    "B": {"id": "B", "name": "박OO", "org": "설계팀(사내)", "device": "LAPTOP-B7"},
    "C": {"id": "C", "name": "이OO", "org": "외부", "phone": "010-****-1234", "device": "MAC-C3"},
    "D": {"id": "D", "name": "최OO", "org": "외부", "phone": "010-****-5678", "device": "PC-D9"},
}


def step(msg):
    input(f"\n{B}▶ {msg}{X}  {D}(엔터){X}")


def kst(iso):
    return datetime.fromisoformat(iso).astimezone(KST).strftime("%H:%M:%S")


def show_path(path_file):
    t = hck.trace(open(path_file, "rb").read())
    ok = t["integrity"]["ok"]
    print(f"\n  문서: {t['title']}   장부 서명 검증: {G + '✅ 정상' if ok else R + '❌ 조작 감지 ' + str(t['integrity']['reasons'])}{X}")
    prev = None
    for i, n in enumerate(t["path"]):
        a = n["actor"]
        leak = prev and "외부" in a["org"] and "외부" not in prev["org"]
        arrow = "   " if i == 0 else (f"{R} ↓ " if leak else " ↓ ")
        if i:
            print(f"  {arrow}{'🔴 최초 외부 유출' if leak else ''}{X}")
        color = R if "외부" in a["org"] else G
        print(f"  {color}{i}. {a['name']:<4} {a['org']:<10}{X} {kst(n['at'])} KST  {D}기기 {a['device']}{X}")
        prev = a


def main():
    img = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "server", "demo", "sample_blueprint.png")
    os.makedirs(OUT, exist_ok=True)
    f = lambda n: os.path.join(OUT, n)
    print(f"{Y}=== TraceGuard 라이브 시연: A → B → C → D 유출 추적 ==={X}  원본: {os.path.basename(img)}")

    step("1. 김OO(설계팀)가 기밀 설계도를 .hck 보호 파일로 등록")
    open(f("A.hck"), "wb").write(hck.create(open(img, "rb").read(), "Q4", "Q4 신제품 설계도", P["A"]))
    hck._save_keys()
    print(f"  → {f('A.hck')} 생성. 내용은 암호화되어 일반 프로그램으로는 열 수 없음")

    step("2. 김OO가 사내 메신저로 박OO에게 공유 → 박OO가 열람")
    new, image, par = hck.open_file(open(f("A.hck"), "rb").read(), P["B"])
    open(f("B.hck"), "wb").write(new)
    open(f("B가_본_화면.png"), "wb").write(image)
    print(f"  → 박OO는 원본을 정상적으로 봄 ({f('B가_본_화면.png')}),  장부: '{par['actor']['name']}에게서 받음' 기록")

    step("3. 박OO가 카톡으로 외부인 이OO에게 몰래 전송 → 이OO가 열람 (이름·전화번호 확인)")
    new, _, par = hck.open_file(open(f("B.hck"), "rb").read(), P["C"])
    open(f("C.hck"), "wb").write(new)
    print(f"  → 장부: 이OO ← {par['actor']['name']}  {R}(회사 밖으로 나감){X}")

    step("4. 이OO가 USB로 최OO에게 다시 넘김 → 최OO가 열람")
    new, _, par = hck.open_file(open(f("C.hck"), "rb").read(), P["D"])
    open(f("D.hck"), "wb").write(new)
    print(f"  → 장부: 최OO ← {par['actor']['name']}")

    step("5. [보안팀] 외부에서 발견된 최OO의 파일(D.hck) 하나만으로 추적")
    show_path(f("D.hck"))

    step("6. [공격] 박OO가 자기 기록을 지운 조작 파일을 만들면?")
    m, p, led = hck.unpack(open(f("D.hck"), "rb").read())
    led = [e for e in led if e["actor"]["id"] != "B"]
    for i, e in enumerate(led):
        e["seq"] = i
    open(f("D_조작.hck"), "wb").write(hck.pack(m, p, led))
    show_path(f("D_조작.hck"))
    try:
        hck.open_file(open(f("D_조작.hck"), "rb").read(), P["D"])
    except PermissionError:
        print(f"  {R}→ 조작된 파일은 열람도 거부됨{X}")

    print(f"\n{Y}=== 끝: 파일을 어떻게 보내든, 열어보는 순간 경로와 시각이 기록된다 ==={X}  결과 폴더: {OUT}")


if __name__ == "__main__":
    hck._load_keys()
    main()
