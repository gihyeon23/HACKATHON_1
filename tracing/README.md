# tracing · .hck 유출 경로 역추적

문서를 `.hck` 보호 파일로 만들어, 어떤 경로로 전달돼도 열람할 때마다 파일 안 장부에 서버 서명과 함께 기록한다.
발견된 파일 하나로 A → B → C → D 경로와 초 단위 시각을 복원한다.

## 구조
| 경로 | 역할 |
|---|---|
| `core/hck.py` | .hck 엔진: 생성(create) · 열람 기록(open_file) · 경로 복원(trace) · 위조 검증(verify_ledger). AES-256-GCM + SHA-256 해시 체인 + HMAC 서명 |
| `core/reverse_trace.py` | 역추적 실행기: .hck 하나(또는 폴더) → 현재 보유자부터 원본 작성자까지, 최초 외부 유출 지점 표시, `--json` 출력 |
| `core/live_demo.py` | 엔터로 한 단계씩 진행하는 터미널 시연 |
| `core/SKILL.md` | .hck 파일 형식 설명 |
| `server/` | FastAPI 서버 (:8001). `hck_service.py`·`hck_store.py`가 core를 SQLite(키·열람 로그)와 연결 |
| `web/` | React 화면 (:5173): 대시보드 · 문서 관리 · 보호 파일 뷰어 · 유출 조사 · 보고서 |
| `e2e_demo.py` | 자동 전체 시나리오 테스트 (⚠️ 시작 시 서버 데이터 초기화) |

## 실행 (레포 루트에서)
```bash
python -m venv .venv && .venv/bin/pip install -r tracing/server/requirements.txt
cp tracing/server/.env.example tracing/server/.env      # HCK_SERVER_SECRET 을 긴 난수로 바꾸기
cd tracing/server && ../../.venv/bin/uvicorn main:app --port 8001   # 터미널 1
cd tracing/web && npm install && npm run dev                        # 터미널 2, 크롬에서 http://localhost:5173
```
- 포트 8000은 워터마크 엔진(`watermark/`)이 쓰므로 트레이싱 서버는 8001을 쓴다.

## 시연 방법 (택1)
**A. 역추적만 (10초)**
```bash
.venv/bin/python tracing/core/reverse_trace.py 파일.hck
```
**B. 처음부터 라이브 (터미널, 2~3분)**
```bash
.venv/bin/python tracing/core/live_demo.py
```
**C. 웹 화면**
- 크롬 → 대시보드의 "유출 문서 분석 시작" 또는 "유출 조사" → .hck 업로드
- 시연 자료 만들기: `cd tracing/server && ../../.venv/bin/python rehearsal.py`

## 주의
- 웹에서 만든 .hck는 웹 서버 키로, 터미널에서 만든 .hck는 `core/.hck_keys.json` 키로 열린다 (서로 못 엶). 역추적은 키가 필요 없어 둘 다 가능
- 시연 중 `e2e_demo.py`나 `/api/demo/reset` 실행 금지 → 서버 키가 지워져 기존 파일이 안 열림
- 뷰어는 크롬에서만 (파일 덮어쓰기 기능)
- 범위 밖: 화면 캡처·촬영으로 그림이 된 이후의 경로 (→ `watermark/`)
- 데이터는 모두 샘플 데이터. 신원은 PoC 라 본인 인증 없이 입력값을 쓴다.
