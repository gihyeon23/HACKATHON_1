# jeongbobada · 문서 유출 추적

## 구조
```
.
├── backend/      자바 웹 (Spring Boot, :8080) — 수신자 대장·검출 이력·API
├── tracing/      .hck 파일 유출 경로 역추적 (Python FastAPI :8001 + React :5173)
├── watermark/    휴대폰 촬영본 워터마크 추출 엔진 (Python Flask, :8000)
├── docker-compose.yml   MySQL + backend
└── .env.example
```

```
[frontend] ──/api──▶ [backend :8080] ──/v1──▶ [watermark :8000]
                                        (예정)─▶ [tracing   :8001]
```

| 폴더 | 추적 대상 | 문서 |
|---|---|---|
| `backend/` | — | `./gradlew build` (backend/ 에서) |
| `tracing/` | 파일 그대로 전달된 경로 (A→B→C→D) | [tracing/README.md](tracing/README.md) |
| `watermark/` | 화면을 촬영해 이미지가 된 유출본의 유출자 | [watermark/API.md](watermark/API.md) |

## 실행
```bash
docker compose up -d --build                                    # MySQL + backend

python -m venv .venv
.venv/bin/pip install -r watermark/requirements.txt -r tracing/server/requirements.txt
cd watermark && WM_KEY=<비밀키> ../.venv/bin/python server.py   # :8000
cd tracing/server && ../../.venv/bin/uvicorn main:app --port 8001
```
