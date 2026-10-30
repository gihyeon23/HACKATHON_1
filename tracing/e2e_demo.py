"""시연 시나리오를 크롬에서 끝까지 자동 재현한다. 백엔드(8001)와 프론트(5173)가 떠 있어야 한다.

  python tracing/e2e_demo.py --runs 3

크롬 파일 선택 창은 자동화할 수 없어서 showOpenFilePicker 만 메모리 가짜로 바꾼다.
화면 코드와 서버는 진짜를 쓴다. 스크린샷은 마지막 회차만 outputs/화면점검/{시각}/ 에 남긴다.
"""
import argparse
import base64
import json
import urllib.request
from datetime import datetime
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

WEB = "http://localhost:5173"
API = "http://localhost:8001"

FAKE_PICKER = """
window.__written = null;
window.showOpenFilePicker = async () => [{
  requestPermission: async () => 'granted',
  getFile: async () => new File([Uint8Array.from(atob(window.__pick), c => c.charCodeAt(0))], 'file.hck'),
  createWritable: async () => ({
    write: async (bytes) => { window.__written = btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')); },
    close: async () => {},
  }),
}];
"""


def post(path):
    urllib.request.urlopen(urllib.request.Request(API + path, method="POST"))


def goto(page, route):
    page.evaluate("r => { location.hash = r }", route)


def view(page, b64):
    page.evaluate("b => { window.__pick = b; window.__written = null }", b64)
    page.get_by_role("button", name=".hck 파일 선택").click()


def external(page, name):
    page.get_by_role("button", name="다른 사람으로 열기").click()
    page.get_by_role("button", name=name, exact=True).click()
    page.get_by_role("button", name="외부인으로 계속").click()


def run(page, shots: Path | None):
    def shot(name):
        if shots:
            page.screenshot(path=shots / f"{name}.png", full_page=True)

    post("/api/demo/restore-logs")
    post("/api/demo/reset")
    page.goto(WEB)
    page.evaluate("localStorage.clear()")
    page.reload()
    shot("01_대시보드_빈상태")

    goto(page, "/docs")
    with page.expect_download() as dl:
        page.get_by_role("button", name="샘플 설계도로 등록").click()
    a_file = base64.b64encode(Path(dl.value.path()).read_bytes()).decode()
    expect(page.get_by_text("어떤 방법으로 보내도 됩니다")).to_be_visible()
    shot("02_문서등록")

    goto(page, "/viewer")
    page.get_by_role("button", name="B 박OO · 설계팀").click()
    view(page, a_file)
    expect(page.get_by_text("김OO님에게서 받은 파일입니다")).to_be_visible()
    b_file = page.evaluate("window.__written")

    external(page, "이OO")
    view(page, b_file)
    expect(page.get_by_text("박OO님에게서 받은 파일입니다")).to_be_visible()
    c_file = page.evaluate("window.__written")

    external(page, "최OO")
    view(page, c_file)
    expect(page.get_by_text("이OO님에게서 받은 파일입니다")).to_be_visible()
    d_file = page.evaluate("window.__written")
    page.wait_for_timeout(300)
    shot("03_뷰어_열람")

    goto(page, "/investigate")
    shot("04_유출조사_업로드")
    page.locator("input[type=file]").set_input_files(
        {"name": "found_D.hck", "mimeType": "application/x-hck", "buffer": base64.b64decode(d_file)})
    expect(page.get_by_text("분석이 완료되었습니다.")).to_be_visible()
    expect(page.get_by_text("최초 외부 유출: 박OO → 이OO")).to_be_visible()
    expect(page.locator(".pnode")).to_have_count(4)
    expect(page.locator(".boundary")).to_be_visible()
    page.wait_for_timeout(400)
    shot("05_추적결과")

    page.get_by_role("button", name="데모: 서버 로그 지우기").click()
    expect(page.get_by_text("기록 없음 ❓")).to_be_visible()
    expect(page.locator(".pnode")).to_have_count(4)
    expect(page.get_by_text("최초 외부 유출: 박OO → 이OO")).to_be_visible()
    page.wait_for_timeout(300)
    shot("06_서버로그_지운뒤")
    page.get_by_role("button", name="데모: 서버 로그 복구").click()
    expect(page.get_by_text("서버 로그 4건을 찾았습니다.")).to_be_visible()

    with page.expect_download() as dl:
        page.get_by_role("button", name="데모: 파일 장부 조작").click()
    bad_file = base64.b64encode(Path(dl.value.path()).read_bytes()).decode()
    expect(page.get_by_text("장부 조작이 감지되었습니다.")).to_be_visible()
    expect(page.locator(".pnode-broken")).to_be_visible()
    page.wait_for_timeout(400)
    shot("07_장부조작_탐지")

    goto(page, "/report")
    expect(page.get_by_text("유출 조사 보고서")).to_be_visible()
    shot("08_보고서")

    goto(page, "/viewer")
    view(page, bad_file)
    expect(page.get_by_text("이 파일은 열 수 없습니다")).to_be_visible()
    shot("09_뷰어_조작본_거부")

    goto(page, "/trace")
    expect(page.locator(".tree-row")).to_have_count(4)
    shot("10_경로추적_트리")
    goto(page, "/")
    page.wait_for_timeout(300)
    shot("11_대시보드")
    if shots:
        page.set_viewport_size({"width": 390, "height": 844})
        goto(page, "/investigate")
        page.wait_for_timeout(300)
        shot("12_휴대폰_대시보드크기")
        page.set_viewport_size({"width": 1440, "height": 900})
    return json.dumps({"경로": "김OO → 박OO → 이OO → 최OO"}, ensure_ascii=False)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--runs", type=int, default=1)
    args = p.parse_args()
    shots = Path("outputs/화면점검") / datetime.now().strftime("%m%d-%H%M")
    shots.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        ctx.add_init_script(FAKE_PICKER)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "403" not in m.text else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        for i in range(args.runs):
            print(f"{i + 1}회차 통과: {run(page, shots if i == args.runs - 1 else None)}")
        browser.close()
    post("/api/demo/reset")
    print(f"콘솔 오류 {len(errors)}건", errors[:5])
    print(f"스크린샷: {shots}")


if __name__ == "__main__":
    main()
