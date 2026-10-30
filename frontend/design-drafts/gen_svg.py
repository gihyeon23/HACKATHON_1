"""워터마크 삽입 흐름(07 문서 등록 · 08 사본 발급 · 09 발급 완료) 시안 SVG 생성.
기존 TraceGuard 화면(1536x1080)과 같은 토큰·레이아웃을 쓴다. 텍스트는 Figma 에서 편집되도록 <text> 로 둔다."""
import sys
from html import escape

OUT = sys.argv[1]
W, H = 1536, 1080
FONT = "Pretendard, 'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif"

BLUE, BLUE50, BLUE100 = "#2563eb", "#eef3fe", "#dde7fd"
INK, INK2, MUTED, MUTED2 = "#111827", "#374151", "#6b7280", "#9ca3af"
LINE, LINE2, ICE, BG = "#e4e9f2", "#d6deeb", "#f5f8fd", "#eef2f9"
GREEN, GREEN600, GREEN50 = "#22c55e", "#16a34a", "#e9f9ef"
NAVY = "#24396b"

ICONS = {
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    "image": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    "building": '<path d="M4 21V9l8-5 8 5v12z"/><path d="M10 21v-5h4v5M9 11h.01M15 11h.01"/>',
    "share": '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    "scan": '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12s2-3.5 5-3.5 5 3.5 5 3.5-2 3.5-5 3.5S7 12 7 12z"/><circle cx="12" cy="12" r="1.2"/>',
    "bell": '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    "chevronRight": '<path d="m9 6 6 6-6 6"/>',
    "chevronDown": '<path d="m6 9 6 6 6-6"/>',
    "close": '<path d="M6 6l12 12M18 6 6 18"/>',
    "refresh": '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
    "download": '<path d="M12 4v11M7 10.5 12 15.5l5-5"/><path d="M5 20h14"/>',
    "arrowRight": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrowDown": '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v8.5M8.5 12.5 12 16l3.5-3.5"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "upload": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "checkCircle": '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9.6"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    "square": '<rect x="5" y="5" width="14" height="14" rx="3"/>',
}


def tw(s, size):
    """대략적인 글자 폭: 한글 0.93em, 공백 0.28em, 그 외 0.55em"""
    return sum(size * 0.93 if ord(ch) > 0x1100 else size * 0.28 if ch == " " else size * 0.55 for ch in s)


def text(x, y, s, size=14, weight=400, fill=INK, anchor="start", ls=None):
    extra = f' letter-spacing="{ls}"' if ls is not None else ""
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}"{extra}>{escape(s)}</text>')


def rect(x, y, w, h, r=0, fill="#fff", stroke=None, sw=1, dash=None, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{s}{d}{extra}/>'


def icon(name, x, y, size=20, color=INK, sw=1.8):
    k = size / 24
    return (f'<g transform="translate({x} {y}) scale({k})" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')


def circle_icon(name, cx, cy, r, bg=BLUE50, color=BLUE, isize=None):
    isize = isize or r
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{bg}"/>' + icon(name, cx - isize / 2, cy - isize / 2, isize, color)


SHADOW = '<filter id="sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#2563eb" flood-opacity="0.06"/></filter>'


def card(x, y, w, h, r=14, fill="#fff"):
    return rect(x, y, w, h, r, fill, LINE, 1, extra=' filter="url(#sh)"')


def button(x, y, w, h, label, kind="primary", icon_name=None, size=16):
    if kind == "primary":
        out = rect(x, y, w, h, 10, BLUE)
        color = "#fff"
    else:
        out = rect(x + 0.5, y + 0.5, w - 1, h - 1, 10, "#fff", BLUE, 1)
        color = BLUE
    width = tw(label, size)
    if icon_name:
        ix = x + w / 2 - (width + 26) / 2
        out += icon(icon_name, ix, y + h / 2 - 9, 18, color)
        out += text(ix + 26, y + h / 2 + size * 0.36, label, size, 600, color)
    else:
        out += text(x + w / 2, y + h / 2 + size * 0.36, label, size, 600, color, "middle")
    return out


def pill(x, y, label, fg, bg, icon_name=None, size=13):
    w = tw(label, size) + (36 if icon_name else 22)
    out = rect(x, y, w, 26, 13, bg)
    tx = x + 11
    if icon_name:
        out += icon(icon_name, x + 10, y + 6, 14, fg, 2.4)
        tx = x + 28
    return out + text(tx, y + 18, label, size, 600, fg)


def slide_thumb(x, y, w, h, wm=False):
    """Pufferfish 표지 슬라이드 축소 그림 (wm=True 면 사본임을 나타내는 표시 없이 동일하게 그림)"""
    k = w / 1624
    out = rect(x, y, w, h, 2, "#fff", LINE2, 1)
    out += rect(x + 63 * k, y + 232 * k, 12 * k, 410 * k, 0, NAVY)
    out += text(x + 110 * k, y + 360 * k, "Pufferfish 재현", max(8, 74 * k), 800, NAVY)
    out += f'<line x1="{x + 110 * k}" y1="{y + 396 * k}" x2="{x + 1360 * k}" y2="{y + 396 * k}" stroke="{LINE2}" stroke-width="1"/>'
    for i, lw in enumerate([150, 1220, 150, 1140]):
        out += rect(x + 110 * k, y + (450 + i * 42) * k, lw * k, 12 * k, 2, "#c7cfdc" if i != 3 else "#9db4ec")
    return out


def frame(step, steps, crumbs, body):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
           f"<defs>{SHADOW}</defs>",
           rect(0, 0, W, H, 0, BG),
           rect(22, 22, W - 44, H - 44, 24, "#f8fafe"),
           f'<path d="M22 {H - 150} Q 768 {H - 260} {W - 22} {H - 190} L {W - 22} {H - 46} Q {W - 22} {H - 22} {W - 46} {H - 22} L 46 {H - 22} Q 22 {H - 22} 22 {H - 46} Z" fill="#e8eefb"/>']
    # 브레드크럼
    x = 56
    for i, c in enumerate(crumbs):
        last = i == len(crumbs) - 1
        out.append(text(x, 64, c, 14, 700 if last else 400, INK if last else MUTED))
        x += tw(c, 14) + 10
        if not last:
            out.append(icon("chevronRight", x, 52, 14, MUTED2))
            x += 24
    out.append(icon("bell", 1340, 50, 24, INK2))
    out.append(f'<circle cx="1425" cy="62" r="18" fill="{BLUE50}"/>' + text(1425, 67, "TC", 13, 700, INK2, "middle"))
    out.append(icon("chevronDown", 1456, 54, 16, INK2))
    # 스테퍼
    xs = [538, 768, 998]
    for i, label in enumerate(steps):
        n = i + 1
        state = "done" if n < step else "current" if n == step else "todo"
        if i < 2:
            lx1, lx2 = xs[i] + 28, xs[i + 1] - 28
            if state == "done":
                out.append(f'<line x1="{lx1}" y1="112" x2="{lx2}" y2="112" stroke="{BLUE}" stroke-width="2"/>')
            elif state == "current":
                mid = (lx1 + lx2) / 2
                out.append(f'<line x1="{lx1}" y1="112" x2="{mid}" y2="112" stroke="{BLUE}" stroke-width="2"/>')
                out.append(f'<line x1="{mid}" y1="112" x2="{lx2}" y2="112" stroke="{LINE2}" stroke-width="2"/>')
            else:
                out.append(f'<line x1="{lx1}" y1="112" x2="{lx2}" y2="112" stroke="{LINE2}" stroke-width="2"/>')
        if state == "todo":
            out.append(f'<circle cx="{xs[i]}" cy="112" r="16" fill="#fff" stroke="{LINE2}" stroke-width="1.5"/>')
            out.append(text(xs[i], 117, str(n), 13, 600, MUTED, "middle"))
            out.append(text(xs[i], 152, label, 14, 400, MUTED, "middle"))
        else:
            out.append(f'<circle cx="{xs[i]}" cy="112" r="16" fill="{BLUE}"/>')
            out.append(icon("check", xs[i] - 7, 105, 14, "#fff", 2.6) if state == "done" else text(xs[i], 117, str(n), 13, 600, "#fff", "middle"))
            out.append(text(xs[i], 152, label, 14, 700 if state == "current" else 400, BLUE, "middle"))
    out.extend(body)
    out.append("</svg>")
    return "\n".join(out)


def head(eyebrow, title, sub, y=210):
    out = []
    if eyebrow:
        out.append(text(768, y, eyebrow, 13, 600, BLUE, "middle", 0.3))
    out.append(text(768, y + 58, title, 40, 800, INK, "middle", -0.8))
    out.append(text(768, y + 100, sub, 17, 400, MUTED, "middle"))
    return out


def label(x, y, s, required=False):
    out = text(x, y, s, 15, 700, INK)
    if required:
        out += text(x + tw(s, 15) + 4, y, "*", 15, 700, BLUE)
    return out


def field(x, y, w, value, placeholder=False, chevron=False):
    out = rect(x + 0.5, y + 0.5, w - 1, 51, 10, "#fff", LINE2, 1)
    out += text(x + 18, y + 32, value, 16, 400, MUTED2 if placeholder else INK)
    if chevron:
        out += icon("chevronDown", x + w - 38, y + 16, 20, MUTED)
    return out


STEPS = ["문서 등록", "사본 발급", "배포본 받기"]


def page07():
    b = head("DOCUMENT REGISTRATION", "배포할 원본 문서를 등록하세요.", "등록한 원본에서 받는 사람마다 워터마크가 들어간 사본을 발급합니다.")
    x, y, w = 352, 350, 832
    b.append(card(x, y, w, 456))
    b.append(label(x + 28, y + 46, "문서 제목", True))
    b.append(field(x + 28, y + 62, w - 56, "Pufferfish 재현 표지"))
    b.append(label(x + 28, y + 160, "원본 이미지", True))
    b.append(text(x + 136, y + 160, "PNG, JPG, JPEG · 최대 50MB", 13, 400, MUTED))
    # 이미지 선택 완료 상태
    bx, by = x + 28, y + 176
    b.append(rect(bx + 0.5, by + 0.5, w - 57, 179, 12, ICE, LINE, 1))
    b.append(rect(bx + 16, by + 16, 262, 148, 8, "#eef2f8"))
    b.append(slide_thumb(bx + 28, by + 28, 238, 136.4))
    tx = bx + 302
    b.append(text(tx, by + 46, "document_3384656813.png", 18, 700, INK))
    b.append(pill(tx + tw("document_3384656813.png", 18) + 12, by + 28, "등록 가능", GREEN600, GREEN50, "check"))
    b.append(text(tx, by + 72, "PNG  |  745.7KB  |  1624 × 931", 13, 400, MUTED))
    b.append(f'<line x1="{tx}" y1="{by + 92}" x2="{bx + w - 80}" y2="{by + 92}" stroke="{LINE}"/>')
    for i, (k, v) in enumerate([("파일 형식", "PNG (이미지 파일)"), ("해상도", "1624 × 931")]):
        yy = by + 122 + i * 30
        b.append(icon("file", tx, yy - 13, 16, MUTED))
        b.append(text(tx + 26, yy, k, 14, 400, INK2))
        b.append(text(bx + w - 80, yy, v, 14, 400, MUTED, "end"))
    b.append(rect(bx + w - 100, by + 16, 34, 34, 8, "#fff", LINE, 1) + icon("close", bx + w - 92, by + 24, 18, MUTED))
    b.append(button(x + 28, y + 376, (w - 68) / 2, 52, "다른 이미지 선택", "outline", "refresh"))
    b.append(button(x + 40 + (w - 68) / 2, y + 376, (w - 68) / 2, 52, "문서 등록", "primary", "arrowRight"))
    # 하단 특징 카드
    feats = [("scan", "보이지 않는 워터마크", "사람 눈에 띄지 않게", "식별 정보를 넣습니다."),
             ("user", "받는 사람별 사본", "사본마다 고유한", "사본 ID가 부여됩니다."),
             ("share", "배포 계보 기록", "누가 누구에게 전달했는지", "사본 대장에 남깁니다.")]
    for i, (ic, t, d1, d2) in enumerate(feats):
        fx = 362 + i * 276
        b.append(rect(fx, 836, 262, 150, 10, "#fff"))
        b.append(circle_icon(ic, fx + 131, 874, 29, isize=22))
        b.append(text(fx + 131, 926, t, 16, 700, INK, "middle"))
        b.append(text(fx + 131, 950, d1, 13, 400, MUTED, "middle"))
        b.append(text(fx + 131, 970, d2, 13, 400, MUTED, "middle"))
    return frame(1, STEPS, ["문서 관리", "새 문서 등록"], b)


def path_node(x, y, w, step, kind, title, sub, ic, state="normal"):
    out = []
    if state == "new":
        out.append(rect(x, y, w, 68, 10, "#fff", BLUE, 1.5, "5 4"))
    elif state == "hl":
        out.append(rect(x, y, w, 68, 10, "#fff", BLUE, 2))
    else:
        out.append(rect(x + 0.5, y + 0.5, w - 1, 67, 10, "#fff", LINE, 1))
    out.append(text(x + 14, y + 30, f"{step}단계", 13, 700, INK))
    out.append(text(x + 14, y + 49, kind, 11, 400, MUTED))
    out.append(circle_icon(ic, x + 86, y + 34, 18, isize=18))
    out.append(text(x + 114, y + 31, title, 14, 700, INK))
    out.append(text(x + 114, y + 50, sub, 12, 400, BLUE if state == "new" else MUTED))
    return "".join(out)


def page08():
    b = head(None, "사본을 받을 사람을 지정하세요.", "받는 사람마다 고유한 사본 ID가 워터마크로 들어갑니다. 전달 관계는 사본 대장에 기록됩니다.", 196)
    x, y = 248, 330
    b.append(card(x, y, 690, 580))
    b.append(label(x + 30, y + 48, "받는 사람 이름", True))
    b.append(field(x + 30, y + 64, 630, "외부 협력 연구실"))
    b.append(label(x + 30, y + 162, "받는 사람 유형", True))
    seg_y = y + 178
    b.append(rect(x + 30.5, seg_y + 0.5, 629, 55, 10, ICE, LINE, 1))
    b.append(icon("user", x + 152, seg_y + 17, 20, MUTED) + text(x + 180, seg_y + 34, "직원", 16, 500, MUTED))
    b.append(rect(x + 348, seg_y + 5, 306, 46, 8, "#fff", BLUE, 1.5))
    b.append(icon("building", x + 462, seg_y + 17, 20, BLUE) + text(x + 490, seg_y + 34, "협력사", 16, 700, BLUE))
    b.append(label(x + 30, y + 286, "전달받은 사본"))
    b.append(text(x + 140, y + 286, "이 사람에게 사본을 넘겨준 사람", 13, 400, MUTED))
    b.append(field(x + 30, y + 302, 630, "COPY-L582 · 연구실 김OO (직원)", chevron=True))
    b.append(text(x + 30, y + 378, "원본에서 바로 배포한다면 '없음 (원본에서 직접)'을 선택하세요.", 13, 400, MUTED))
    b.append(button(x + 30, y + 470, 630, 54, "사본 발급", "primary", "plus", 17))
    b.append(text(x + 345, y + 552, "워터마크를 넣는 데 몇 초 걸립니다.", 13, 400, MUTED, "middle"))
    # 오른쪽: 원본 정보 + 발급 후 경로 미리보기
    rx, ry, rw = 958, 330, 330
    b.append(card(rx, ry, rw, 580))
    b.append(pill(rx + 20, ry + 20, "원본 문서", BLUE, BLUE50, "file"))
    b.append(rect(rx + 20, ry + 58, rw - 40, 128, 10, "#eef2f8"))
    b.append(slide_thumb(rx + 62, ry + 68, rw - 124, (rw - 124) * 931 / 1624))
    b.append(text(rx + 20, ry + 214, "Pufferfish 재현 표지", 17, 700, INK))
    b.append(text(rx + 20, ry + 236, "DOC-A002  ·  1624 × 931", 13, 400, MUTED))
    b.append(f'<line x1="{rx + 20}" y1="{ry + 254}" x2="{rx + rw - 20}" y2="{ry + 254}" stroke="{LINE}"/>')
    b.append(text(rx + 20, ry + 282, "발급 후 배포 경로", 14, 700, INK))
    b.append(text(rx + rw - 20, ry + 282, "총 3단계", 12, 400, MUTED, "end"))
    nodes = [(1, "원본", "Pufferfish 재현 표지", "DOC-A002", "file", "normal"),
             (2, "사본", "연구실 김OO", "COPY-L582", "user", "normal"),
             (3, "사본", "외부 협력 연구실", "발급 후 사본 ID 부여", "building", "new")]
    ny = ry + 298
    for i, n in enumerate(nodes):
        b.append(path_node(rx + 20, ny, rw - 40, *n))
        if i < len(nodes) - 1:
            b.append(icon("arrowDown", rx + 96, ny + 70, 16, BLUE, 1.6))
        ny += 88
    # 하단 안내
    b.append(rect(248, 930, 1040, 70, 14, BLUE50))
    b.append(circle_icon("lock", 290, 965, 23, BLUE100, BLUE, 20))
    b.append(text(328, 958, "발급한 사본은 사본 대장에 기록됩니다.", 15, 700, BLUE))
    b.append(text(328, 980, "나중에 유출 이미지를 분석하면 이 기록으로 원본까지의 배포 경로를 보여줍니다. 실제 유출자를 확정하지는 않습니다.", 13, 400, INK2))
    return frame(2, STEPS, ["문서 관리", "Pufferfish 재현 표지", "사본 발급"], b)


def page09():
    b = []
    b.append(f'<circle cx="566" cy="232" r="30" fill="{GREEN}"/>' + icon("check", 548, 214, 36, "#fff", 3))
    b.append(text(612, 246, "사본을 발급했습니다.", 38, 800, INK, ls=-0.8))
    b.append(text(768, 296, "배포본을 내려받아 받는 사람에게 전달하세요. 유출되면 이 사본 ID로 배포 경로를 추적할 수 있습니다.", 16, 400, INK2, "middle"))
    x, y, w = 157, 326, 1222
    b.append(card(x, y, w, 214))
    b.append(rect(x + 20, y + 20, 290, 174, 10, "#eef2f8"))
    b.append(slide_thumb(x + 36, y + 40, 258, 258 * 917 / 1600))
    tx = x + 342
    b.append(text(tx, y + 50, "COPY-D034.png", 20, 700, INK))
    b.append(text(tx, y + 78, "1600 × 917  |  PNG", 15, 400, MUTED))
    rows = [("사본 ID", "COPY-D034"), ("받는 사람", "외부 협력 연구실 (협력사)"), ("전달받은 사본", "COPY-L582 · 연구실 김OO")]
    for i, (k, v) in enumerate(rows):
        yy = y + 120 + i * 30
        b.append(text(tx, yy, k, 15, 400, MUTED))
        b.append(text(tx + 124, yy, v, 15, 600, INK))
    sx = x + 870
    b.append(f'<line x1="{sx}" y1="{y + 100}" x2="{sx}" y2="{y + 190}" stroke="{LINE}"/>')
    b.append(text(sx + 26, y + 116, "원본 문서", 13, 400, MUTED))
    b.append(text(sx + 26, y + 138, "Pufferfish 재현 표지 (DOC-A002)", 14, 500, INK))
    b.append(text(sx + 26, y + 166, "화질 (PSNR · SSIM)", 13, 400, MUTED))
    b.append(text(sx + 26, y + 188, "39.8 dB  ·  0.963", 14, 500, INK))
    b.append(pill(x + w - 312, y + 28, "발급 완료", GREEN600, GREEN50, "check", 14))
    b.append(button(x + w - 200, y + 18, 176, 46, "배포본 다운로드", "primary", "download", 15))
    # 사본 대장
    ty = 562
    b.append(card(x, ty, w, 290))
    b.append(text(x + 26, ty + 40, "사본 대장", 18, 700, INK))
    b.append(text(x + 116, ty + 40, "Pufferfish 재현 표지 · 총 2건", 14, 400, MUTED))
    cols = [(x + 26, "사본 ID"), (x + 236, "받는 사람"), (x + 516, "유형"), (x + 676, "전달받은 사본"), (x + w - 26, "배포본")]
    hy = ty + 64
    b.append(rect(x + 14, hy, w - 28, 40, 8, ICE))
    for i, (cx, c) in enumerate(cols):
        b.append(text(cx, hy + 26, c, 13, 600, MUTED, "end" if i == 4 else "start"))
    data = [("COPY-L582", "연구실 김OO", "user", "직원", "없음 (원본에서 직접)", False),
            ("COPY-D034", "외부 협력 연구실", "building", "협력사", "COPY-L582 · 연구실 김OO", True)]
    for i, (code, name, ic, kind, parent, new) in enumerate(data):
        ry = hy + 52 + i * 64
        if new:
            b.append(rect(x + 14, ry, w - 28, 56, 10, "#f7faff", BLUE, 1.5))
        else:
            b.append(f'<line x1="{x + 14}" y1="{ry + 60}" x2="{x + w - 14}" y2="{ry + 60}" stroke="{LINE}"/>')
        b.append(text(cols[0][0], ry + 34, code, 15, 700, INK))
        if new:
            b.append(pill(cols[0][0] + tw(code, 15) + 12, ry + 15, "방금 발급", BLUE, BLUE50, None, 12))
        b.append(text(cols[1][0], ry + 34, name, 15, 500, INK))
        b.append(icon(ic, cols[2][0], ry + 19, 18, BLUE) + text(cols[2][0] + 26, ry + 34, kind, 15, 400, INK2))
        b.append(text(cols[3][0], ry + 34, parent, 15, 400, MUTED))
        b.append(rect(x + w - 146, ry + 10, 120, 36, 8, "#fff", LINE2, 1))
        b.append(icon("download", x + w - 130, ry + 19, 18, BLUE) + text(x + w - 104, ry + 34, "내려받기", 14, 600, INK))
    b.append(icon("info", x + 26, ty + 250, 16, MUTED) + text(x + 50, ty + 263, "사본 대장은 GET /api/recipients 의 기록이며, 배포 시각은 표시하지 않습니다.", 13, 400, MUTED))
    b.append(button(157, 874, 578, 60, "사본 하나 더 발급", "outline", "plus", 17))
    b.append(button(751, 874, 628, 60, "유출 이미지 분석하기", "primary", "arrowRight", 17))
    return frame(3, STEPS, ["문서 관리", "Pufferfish 재현 표지", "발급 완료"], b)



def shield(x, y, size, fill, inner):
    k = size / 24
    return (f'<g transform="translate({x} {y}) scale({k})"><path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6z" fill="{fill}"/>'
            f'<path d="M12 7.2 8 8.7v3.1c0 2.5 1.7 4.5 4 5.1 2.3-.6 4-2.6 4-5.1V8.7z" fill="{inner}"/></g>')


def cta_card(x, y, w, ic, title, desc, primary=True):
    """랜딩 히어로의 시작 카드. primary=False 는 보조 카드(발급)"""
    h = 92
    out = rect(x, y, w, h, 10, "#fff" if primary else "rgba(255,255,255,0.12)",
               None if primary else "rgba(255,255,255,0.55)", 1)
    if primary:
        out = rect(x, y, w, h, 10, "#fff", extra=' filter="url(#hsh)"')
    fg, sub = (INK, MUTED) if primary else ("#fff", "#dbe6ff")
    out += f'<circle cx="{x + 56}" cy="{y + h / 2}" r="31" fill="{BLUE50 if primary else "rgba(255,255,255,0.18)"}"/>'
    out += icon(ic, x + 42, y + h / 2 - 14, 28, BLUE if primary else "#fff")
    out += text(x + 108, y + 40, title, 20, 700, fg)
    out += text(x + 108, y + 66, desc, 13, 400, sub)
    gx = x + w - 52
    out += f'<circle cx="{gx}" cy="{y + h / 2}" r="25" fill="{BLUE if primary else "#fff"}"/>'
    out += icon("arrowRight", gx - 12, y + h / 2 - 12, 24, "#fff" if primary else BLUE, 2.2)
    return out


def page06():
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="1240" viewBox="0 0 {W} 1240">',
           '<defs>' + SHADOW +
           '<linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5ee8"/><stop offset="1" stop-color="#1f4fd8"/></linearGradient>'
           '<radialGradient id="glow" cx="1" cy="0" r="0.9"><stop offset="0" stop-color="#3b6ff0"/><stop offset="1" stop-color="#3b6ff0" stop-opacity="0"/></radialGradient>'
           '<filter id="hsh" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0a1e5a" flood-opacity="0.18"/></filter>'
           '</defs>',
           rect(0, 0, W, 1240, 0, ICE),
           rect(0, 0, W, 700, 0, "url(#hero)"), rect(0, 0, W, 700, 0, "url(#glow)")]
    # 상단 내비 (메뉴는 텍스트만, 로그인 없음)
    out.append(shield(124, 80, 30, "#fff", "#2a5ee8") + text(162, 102, "TraceGuard", 21, 700, "#fff"))
    for i, m in enumerate(["제품 소개", "주요 기능", "도입 효과", "보안 기술", "고객사례"]):
        out.append(text(338 + i * 87, 99, m, 15, 400, "#e6edff"))
    out.append(rect(1252, 72, 160, 44, 8, "#fff") + text(1316, 100, "무료로 시작하기", 15, 700, BLUE, "middle") + icon("arrowRight", 1376, 86, 16, BLUE, 2.2))
    # 카피
    out.append(text(124, 190, "DOCUMENT SECURITY & TRACEABILITY", 13, 400, "#dbe6ff", ls=0.3))
    out.append(text(124, 262, "문서가 어디서 왔는지,", 52, 800, "#fff", ls=-1.5))
    out.append(text(124, 326, "이제 추적할 수 있습니다.", 52, 800, "#fff", ls=-1.5))
    out.append(text(124, 378, "배포하는 문서마다 보이지 않는 워터마크를 넣고,", 18, 400, "#eef3ff"))
    out.append(text(124, 406, "유출되면 확인된 배포 경로를 역추적하는 기업용 문서 보안 솔루션입니다.", 18, 400, "#eef3ff"))
    # 진입 카드 2개: 분석(주) · 발급(보조)
    out.append(cta_card(124, 432, 556, "upload", "유출 문서 분석 시작", "이미지 파일을 업로드해 사본 식별과 배포 경로를 확인하세요."))
    out.append(cta_card(124, 538, 556, "file", "배포본 발급하기", "원본을 등록하고 받는 사람별 워터마크 사본을 만드세요.", primary=False))
    out.append(rect(682, 552, 64, 22, 11, "#ffd75e") + text(714, 567, "NEW", 11, 800, "#7a4b00", "middle"))
    for i, t in enumerate(["이미지 (JPG, PNG) 지원", "받는 사람별 사본 발급", "배포 경로 시각화"]):
        cx = 124 + i * 186
        out.append(icon("checkCircle", cx, 654, 18, "#fff") + text(cx + 26, 668, t, 14, 400, "#fff"))
    # 오른쪽 제품 미리보기 (기존 랜딩과 같은 구성, 신뢰도 % 와 날짜 없음)
    px, py = 760, 160
    out.append(rect(px, py, 820, 500, 22, "rgba(255,255,255,0.2)"))
    out.append(rect(px + 10, py + 12, 150, 470, 14, "#fff"))
    out.append(shield(px + 28, py + 32, 18, BLUE, "#fff") + text(px + 52, py + 46, "TraceGuard", 13, 700, BLUE))
    for i, (ic, m) in enumerate([("square", "대시보드"), ("file", "문서 관리"), ("search", "유출 조사"), ("share", "경로 추적"), ("square", "보고서")]):
        yy = py + 84 + i * 38
        if m == "유출 조사":
            out.append(rect(px + 18, yy - 18, 134, 32, 6, BLUE50) + rect(px + 18, yy - 18, 3, 32, 0, BLUE))
        col = BLUE if m == "유출 조사" else INK2
        out.append(icon(ic if ic in ICONS else "file", px + 30, yy - 9, 14, col) + text(px + 52, yy + 3, m, 12, 600 if m == "유출 조사" else 400, col))
    mx = px + 172
    out.append(rect(mx, py + 12, 640, 488, 14, "#fff"))
    out.append(text(mx + 18, py + 40, "유출 조사 > OLED_설계도.png", 11, 400, MUTED))
    out.append(f'<circle cx="{mx + 38}" cy="{py + 82}" r="19" fill="{GREEN}"/>' + icon("check", mx + 29, py + 73, 18, "#fff", 3))
    out.append(text(mx + 70, py + 80, "분석이 완료되었습니다.", 16, 700, INK) + text(mx + 70, py + 99, "업로드한 파일에서 사본이 식별되었으며, 배포 경로를 추적할 수 있습니다.", 11, 400, MUTED))
    out.append(rect(mx + 18.5, py + 124.5, 603, 107, 10, "#fff", LINE, 1))
    out.append(slide_thumb(mx + 34, py + 140, 120, 69))
    for i, (k, v) in enumerate([("사본 ID", "COPY-C203"), ("원본 문서", "DOC-A001"), ("검출 등급", "높음")]):
        out.append(text(mx + 176, py + 166 + i * 20, k, 11, 400, MUTED2) + text(mx + 250, py + 166 + i * 20, v, 12, 500, INK))
    out.append(text(mx + 176, py + 146, "OLED_설계도.png", 13, 700, INK))
    out.append(rect(mx + 530, py + 140, 76, 30, 6, "#fff", LINE, 1) + text(mx + 568, py + 160, "원본 보기", 12, 400, INK, "middle"))
    for i, t in enumerate(["배포 경로", "검출 결과", "상세 정보", "관련 문서"]):
        tx = mx + 30 + i * 100
        out.append(text(tx, py + 272, t, 12, 700 if i == 0 else 400, BLUE if i == 0 else INK2))
    out.append(f'<line x1="{mx + 18}" y1="{py + 288}" x2="{mx + 622}" y2="{py + 288}" stroke="{LINE}"/>' + rect(mx + 18, py + 286, 90, 2, 0, BLUE))
    for i, (ic, n, c, hl) in enumerate([("building", "협력사 C", "COPY-C203", True), ("user", "직원 B", "COPY-B102", False), ("file", "원본 문서", "DOC-A001", False)]):
        nx = mx + 18 + i * 206
        out.append(rect(nx + 0.5, py + 312.5, 175, 67, 8, "#fdf1f1" if hl else "#fff", "#f6caca" if hl else LINE, 1))
        out.append(f'<circle cx="{nx + 30}" cy="{py + 346}" r="17" fill="{"#fbe0e0" if hl else BLUE50}"/>' + icon(ic, nx + 22, py + 338, 16, "#ef4444" if hl else BLUE))
        out.append(text(nx + 56, py + 342, n, 13, 700, INK) + text(nx + 56, py + 360, f"({c})", 11, 400, MUTED))
        if i < 2:
            out.append(icon("arrowRight", nx + 180, py + 337, 18, MUTED2))
    # HOW IT WORKS: 발급부터 추적까지
    out.append('<g transform="translate(0 60)">')
    out.append(text(768, 704, "HOW IT WORKS", 13, 600, BLUE, "middle", 0.3))
    out.append(text(768, 754, "배포부터 유출 조사까지, 세 단계로 간단하게.", 34, 800, INK, "middle", -0.6))
    out.append(text(768, 790, "문서를 배포할 때 사본을 발급해 두면, 유출된 이미지 한 장으로 배포 경로를 추적합니다.", 16, 400, MUTED, "middle"))
    cards = [("01", "배포본 발급", "원본을 등록하고 받는 사람마다", "고유한 워터마크 사본을 만듭니다."),
             ("02", "유출 이미지 분석", "유출된 이미지를 업로드하면", "워터마크로 사본을 식별합니다."),
             ("03", "배포 경로 역추적", "식별된 사본에서 원본까지의", "배포 계보를 시각화합니다.")]
    for i, (no, t, d1, d2) in enumerate(cards):
        cx = 124 + i * 436
        out.append(rect(cx + 0.5, 818.5, 415, 291, 14, "#fff", LINE, 1))
        out.append(f'<circle cx="{cx + 44}" cy="{866}" r="23" fill="#fff" stroke="{LINE}"/>' + text(cx + 44, 873, no, 20, 800, BLUE, "middle"))
        out.append(text(cx + 84, 862, t, 19, 800, INK) + text(cx + 84, 888, d1, 13, 400, MUTED) + text(cx + 84, 908, d2, 13, 400, MUTED))
        vx, vy = cx + 22, 940
        out.append(rect(vx, vy, 372, 140, 10, BG))
        if i == 0:
            out.append(slide_thumb(vx + 24, vy + 30, 120, 69))
            out.append(icon("arrowRight", vx + 156, vy + 54, 22, BLUE))
            for j, (nm, code, ic) in enumerate([("직원 B", "COPY-B102", "user"), ("협력사 C", "COPY-C203", "building")]):
                yy = vy + 22 + j * 52
                out.append(rect(vx + 194, yy, 160, 42, 8, "#fff") + f'<circle cx="{vx + 216}" cy="{yy + 21}" r="13" fill="{BLUE50}"/>' + icon(ic, vx + 209, yy + 14, 14, BLUE))
                out.append(text(vx + 238, yy + 18, nm, 12, 700, INK) + text(vx + 238, yy + 33, code, 10, 400, MUTED))
        elif i == 1:
            out.append(rect(vx + 40, vy + 22, 140, 96, 4, "#fff", "#9cb6f3", 1.5, "5 4") + icon("image", vx + 94, vy + 54, 30, BLUE))
            out.append(rect(vx + 200, vy + 30, 150, 80, 6, "#111a2e"))
            out.append(text(vx + 216, vy + 54, "사본 ID", 10, 400, "#9aa4b8") + text(vx + 216, vy + 72, "COPY-C203", 14, 700, "#fff"))
            out.append(text(vx + 216, vy + 90, "검출 등급", 10, 400, "#9aa4b8") + text(vx + 216, vy + 104, "높음", 13, 700, "#fff"))
        else:
            for j, (l, t2, col) in enumerate([("C", "협력사", "#ef4444"), ("B", "직원", BLUE), ("A", "원본", MUTED2)]):
                dx = vx + 70 + j * 116
                if j:
                    out.append(f'<line x1="{dx - 92}" y1="{vy + 58}" x2="{dx - 24}" y2="{vy + 58}" stroke="#94a8d6" stroke-width="1.5" stroke-dasharray="4 4"/>')
                out.append(f'<circle cx="{dx}" cy="{vy + 58}" r="18" fill="{col}" stroke="#fff" stroke-width="6"/>' + text(dx, vy + 63, l, 13, 700, "#fff", "middle"))
                out.append(text(dx, vy + 104, t2, 14, 700, INK, "middle"))
    out.append("</g></svg>")
    return "\n".join(out)


def page02b():
    b = head("DOCUMENT TRACEABILITY", "유출된 문서를 업로드하세요.", "이미지에 삽입된 워터마크를 분석하여 사본을 식별하고, 확인된 배포 경로를 추적합니다.")
    x, y, w = 352, 336, 832
    b.append(rect(x + 0.5, y + 0.5, w - 1, 271, 14, "rgba(255,255,255,0.6)", "#c9d3e4", 1.5, "6 5"))
    b.append(icon("upload", 732, y + 30, 72, BLUE, 1.4))
    b.append(text(768, y + 148, "파일을 여기에 끌어다 놓으세요.", 20, 700, INK, "middle"))
    b.append(text(768, y + 184, "PNG, JPG, JPEG 파일을 지원합니다. (최대 50MB)", 16, 400, INK2, "middle"))
    b.append(button(657, y + 204, 222, 48, "파일 선택", "primary", "file"))
    b.append(f'<line x1="536" y1="{y + 312}" x2="740" y2="{y + 312}" stroke="{LINE2}"/>' + text(768, y + 316, "또는", 13, 400, MUTED, "middle") + f'<line x1="796" y1="{y + 312}" x2="1000" y2="{y + 312}" stroke="{LINE2}"/>')
    dy = y + 340
    b.append(rect(556.5, dy + 0.5, 423, 75, 10, "#fff", LINE, 1))
    b.append(circle_icon("file", 596, dy + 38, 26, isize=22))
    b.append(text(636, dy + 33, "데모 이미지로 체험하기", 15, 700, INK) + text(636, dy + 54, "샘플 문서로 분석 결과를 바로 확인해보세요.", 12, 400, MUTED))
    b.append(icon("chevronRight", 948, dy + 28, 20, INK2))
    # 보조 링크 (새로 추가)
    ly = dy + 108
    b.append(rect(556.5, ly - 22.5, 423, 40, 20, BLUE50, BLUE100, 1))
    b.append(text(578, ly + 3, "아직 배포본이 없나요?", 13, 400, INK2))
    b.append(text(712, ly + 3, "워터마크 사본 발급하기", 13, 700, BLUE))
    b.append(icon("arrowRight", 860, ly - 10, 16, BLUE, 2.2))
    b.append(rect(890, ly - 13, 64, 22, 11, BLUE) + text(922, ly + 2, "NEW", 11, 800, "#fff", "middle"))
    feats = [("lock", "안전한 분석", "업로드한 파일은 암호화되어", "안전하게 처리됩니다."),
             ("scan", "자동 워터마크 검출", "이미지에서 식별 정보를", "자동으로 분석합니다."),
             ("share", "배포 경로 추적", "등록된 문서와 사본의", "전달 경로를 확인합니다.")]
    for i, (ic, t, d1, d2) in enumerate(feats):
        fx = 362 + i * 276
        b.append(rect(fx, 870, 262, 140, 10, "#fff"))
        b.append(circle_icon(ic, fx + 131, 904, 27, isize=22))
        b.append(text(fx + 131, 952, t, 16, 700, INK, "middle") + text(fx + 131, 976, d1, 13, 400, MUTED, "middle") + text(fx + 131, 996, d2, 13, 400, MUTED, "middle"))
    return frame(1, ["파일 업로드", "분석 진행", "결과 확인"], ["유출 조사", "새 조사 시작"], b)


def page00():
    FW, FH = 1920, 1080
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{FW}" height="{FH}" viewBox="0 0 {FW} {FH}">',
           '<defs>' + SHADOW + f'<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 10 5 0 10z" fill="{BLUE}"/></marker>'
           f'<marker id="arg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 10 5 0 10z" fill="{MUTED2}"/></marker></defs>',
           rect(0, 0, FW, FH, 0, "#fff")]
    out.append(text(80, 100, "TraceGuard 전체 화면 흐름", 36, 800, INK, ls=-0.6))
    out.append(text(80, 138, "배포본 발급(신규 07~09)과 유출 조사(기존 02~06)가 랜딩에서 갈라지고, 발급 완료 화면에서 다시 유출 조사로 이어집니다.", 17, 400, MUTED))
    # 범례
    out.append(rect(1460, 74, 18, 18, 4, "#fff", BLUE, 2) + text(1488, 89, "신규 화면", 14, 400, INK2))
    out.append(rect(1590, 74, 18, 18, 4, "#fff", LINE2, 1.5) + text(1618, 89, "기존 화면 (변경 없음)", 14, 400, INK2))
    out.append(rect(1460, 104, 18, 18, 4, "#fff", BLUE, 2, "4 3") + text(1488, 119, "기존 화면에 요소 추가", 14, 400, INK2))

    def node(x, y, no, title, sub, kind="old", w=230, h=104):
        st = {"old": (LINE2, 1.5, None), "new": (BLUE, 2, None), "mod": (BLUE, 2, "6 4")}[kind]
        o = rect(x, y, w, h, 14, "#fff", st[0], st[1], st[2], ' filter="url(#sh)"')
        o += text(x + 20, y + 34, no, 13, 700, BLUE if kind != "old" else MUTED)
        o += text(x + 20, y + 62, title, 18, 800, INK)
        o += text(x + 20, y + 86, sub, 12, 400, MUTED)
        return o

    def arrow(x1, y1, x2, y2, label=None, grey=False, path=None):
        col = MUTED2 if grey else BLUE
        d = path or f"M{x1} {y1} L{x2} {y2}"
        o = f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2" {"stroke-dasharray=\"6 5\"" if grey else ""} marker-end="url(#{"arg" if grey else "ar"})"/>'
        if label:
            o += text((x1 + x2) / 2, min(y1, y2) - 10, label, 12, 500, col, "middle")
        return o

    # 랜딩
    out.append(node(80, 470, "01 · 수정", "랜딩", "진입 카드 2개 (분석 · 발급)", "mod", 240, 120))
    # 유출 조사 줄
    ry = 300
    out.append(text(400, ry - 40, "유출 조사", 20, 800, INK) + text(400 + tw("유출 조사", 20) + 14, ry - 40, "기존 화면", 14, 400, MUTED))
    xs = [400, 690, 980, 1270, 1560]
    tops = [("02 · 수정", "파일 업로드", "+ 사본 발급 보조 링크", "mod"), ("03", "분석 시작", "파일 확인 · 분석 시작", "old"),
            ("04", "분석 진행", "1초 폴링 · 취소", "old"), ("05", "결과 확인", "사본 · 원본 · 검출 등급", "old"),
            ("06", "배포 경로 모달", "원본 → … → 식별된 사본", "old")]
    for i, (no, t, sub, k) in enumerate(tops):
        out.append(node(xs[i], ry, no, t, sub, k))
        if i < 4:
            out.append(arrow(xs[i] + 230, ry + 52, xs[i + 1] - 4, ry + 52))
    # 배포본 발급 줄
    by = 680
    out.append(text(400, by - 40, "배포본 발급", 20, 800, INK) + text(400 + tw("배포본 발급", 20) + 14, by - 40, "신규 화면", 14, 400, BLUE))
    bots = [("07 · 신규", "문서 등록", "제목 · 원본 이미지"), ("08 · 신규", "사본 발급", "받는 사람 · 전달받은 사본"), ("09 · 신규", "발급 완료 · 사본 대장", "배포본 다운로드", )]
    for i, (no, t, sub) in enumerate(bots):
        out.append(node(xs[i], by, no, t, sub, "new"))
        if i < 2:
            out.append(arrow(xs[i] + 230, by + 52, xs[i + 1] - 4, by + 52))
    # 랜딩 → 두 흐름
    out.append(arrow(320, 510, 396, ry + 52, path=f"M320 510 C 360 510, 350 {ry + 52}, 396 {ry + 52}"))
    out.append(text(250, 420, "유출 문서 분석 시작", 12, 600, BLUE))
    out.append(arrow(320, 550, 396, by + 52, path=f"M320 550 C 360 550, 350 {by + 52}, 396 {by + 52}"))
    out.append(text(250, 646, "배포본 발급하기", 12, 600, BLUE))
    # 02 보조 링크 → 07
    out.append(arrow(515, ry + 104, 515, by - 4, grey=True))
    out.append(text(526, (ry + by) / 2 + 4, "워터마크 사본 발급하기 (보조 링크)", 12, 500, MUTED))
    # 09 → 02 (유출 이미지 분석하기)
    out.append(arrow(1095, by, 515, ry + 104, grey=True, path=f"M1095 {by - 2} C 1095 {by - 120}, 640 {by - 60}, 560 {ry + 108}"))
    out.append(text(910, by - 96, "유출 이미지 분석하기", 12, 500, MUTED))
    # 09 → 08 (사본 하나 더 발급)
    out.append(arrow(1095, by + 104, 805, by + 104, grey=True, path=f"M1095 {by + 106} C 1095 {by + 170}, 805 {by + 170}, 805 {by + 108}"))
    out.append(text(950, by + 180, "사본 하나 더 발급", 12, 500, MUTED, "middle"))
    # 06 ← 05 모달 관계, 데이터 연결 메모
    out.append(rect(1270, by, 520, 210, 14, ICE))
    out.append(text(1294, by + 36, "두 흐름을 잇는 데이터", 16, 800, INK))
    notes = ["08에서 발급한 사본은 사본 대장(GET /api/recipients)에 기록", "05·06의 배포 경로는 이 대장의 부모 관계를 따라 계산",
             "07 원본 이미지에 사본마다 고유 워터마크(사본 ID)를 삽입", "문서 목록 API가 없어 07은 목록 없이 새 문서만 등록",
             "실제 유출자를 확정하지 않으며, 배포 시각은 표시하지 않음"]
    for i, n in enumerate(notes):
        out.append(f'<circle cx="{1300}" cy="{by + 66 + i * 30}" r="3" fill="{BLUE}"/>' + text(1314, by + 71 + i * 30, n, 13, 400, INK2))
    out.append("</svg>")
    return "\n".join(out)


for name, fn in [("00_전체흐름.svg", page00), ("06_랜딩_진입점.svg", page06), ("02b_업로드_발급링크.svg", page02b), ("07_문서등록.svg", page07), ("08_사본발급.svg", page08), ("09_발급완료_사본대장.svg", page09)]:
    with open(f"{OUT}/{name}", "w", encoding="utf-8") as f:
        f.write(fn())
    print(name)
