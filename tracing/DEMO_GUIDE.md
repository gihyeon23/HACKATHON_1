# TraceGuard 역추적 — 코드와 시연 자료 정리

## 1. 역추적 핵심 코드 (`tracing/hck-format/scripts/`)
| 파일 | 역할 |
|---|---|
| `hck.py` | .hck 엔진: 생성(create) · 열람 기록(open_file) · 경로 복원(trace) · 위조 검증(verify_ledger). AES-256-GCM + SHA-256 해시 체인 + HMAC 서명 |
| `reverse_trace.py` ⭐ | **역추적 실행기**: .hck 하나(또는 폴더) → 현재 보유자부터 원본 작성자까지 거슬러 올라감, 최초 외부 유출 지점 표시, `--json` 출력 |
| `live_demo.py` | 엔터로 한 단계씩 진행하는 라이브 시연 (A→B→C→D 생성·열람 → 역추적 → 조작 탐지) |
| `.hck_keys.json` | 터미널 시연용 키 보관 파일 (웹 서버 키와 별개) |

## 2. 웹 (Antigravity가 만든 것, `poc/`)
| 경로 | 역할 |
|---|---|
| `poc/backend/main.py` | FastAPI API (/api/hck/create, /api/hck/open, /api/trace, 데모용 wipe·reset) |
| `poc/backend/hck_service.py`, `hck_store.py` | hck.py를 SQLite(키·열람 로그)와 연결 |
| `poc/backend/.env` | `HCK_SERVER_SECRET` (서명 비밀값, 외부 공유 금지) |
| `poc/backend/storage/traceguard.db` | 문서 키 + 서버 열람 로그 |
| `poc/frontend/` | React 화면: 대시보드 · 문서 관리 · 보호 파일 뷰어 · 유출 조사 · 보고서 |
| `poc/e2e_demo.py` | 자동 전체 시나리오 테스트 (⚠️ 시작 시 서버 데이터 초기화) |

## 3. 시연용 자료
| 파일 | 내용 |
|---|---|
| `poc/backend/demo/found_D.hck` | 웹으로 만든 "외부에서 발견된 파일" (김OO→박OO→이OO→최OO) |
| `poc/backend/demo/sample_blueprint.png` | 샘플 설계도 이미지 |
| `demo/live/A~D.hck`, `D_조작.hck`, `B가_본_화면.png` | live_demo.py 결과물 (정상 경로 + 조작 파일) |
| `tracing/ui-mockups/team_TraceGuard.png` | 팀 디자인 시안 |
| `tracing/tracing-pitch/SKILL.md` | 문제정의·근거 사례·예상 질문과 답 |

## 4. 시연 방법 (택1)
**A. 역추적만 바로 (가장 안전, 10초)**
```bash
.venv/bin/python tracing/hck-format/scripts/reverse_trace.py poc/backend/demo/found_D.hck
.venv/bin/python tracing/hck-format/scripts/reverse_trace.py demo/live/D_조작.hck   # 조작 탐지
```
**B. 처음부터 라이브 (터미널, 2~3분)**
```bash
.venv/bin/python tracing/hck-format/scripts/live_demo.py
```
**C. 웹 화면 (발표 메인)**
```bash
cd poc/backend && ../../.venv/bin/uvicorn main:app --port 8000      # 터미널 1
cd poc/frontend && npm run dev                                       # 터미널 2
```
크롬 → 대시보드의 "유출 문서 분석 시작" 또는 "유출 조사" → `poc/backend/demo/found_D.hck` 업로드

## 5. 주의
- 웹에서 만든 .hck는 웹 서버 키로, 터미널에서 만든 .hck는 `.hck_keys.json` 키로 열린다 (서로 못 엶). **역추적(reverse_trace)은 키가 필요 없어 둘 다 가능**
- 시연 중 `e2e_demo.py`나 `/api/demo/reset` 실행 금지 → 서버 키가 지워져 기존 파일이 안 열림
- 뷰어는 크롬에서만 (파일 덮어쓰기 기능)
- 범위 밖: 화면 캡처·촬영으로 그림이 된 이후의 경로
