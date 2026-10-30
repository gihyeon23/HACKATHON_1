# TraceGuard 프론트엔드

유출 의심 이미지를 올려 배포 사본을 식별하고, 등록된 배포 경로를 보여주는 화면입니다.
작업 규칙은 [AGENTS.md](AGENTS.md), API 는 [docs/API_SPEC.md](../docs/API_SPEC.md) 를 따릅니다.

## 실행

```bash
cp .env.example .env.local     # VITE_API_BASE_URL=http://localhost:8080
npm install
npm run dev                    # http://localhost:5173 (백엔드 CORS 기본 허용 포트)
```

백엔드 실행은 [docs/API_SPEC.md](../docs/API_SPEC.md) 7장을 참고하세요.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (포트 5173 고정) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 (`dist/`) |

## 구조

```
src/
  api/types.ts        명세서 8장 타입 그대로
  api/client.ts       모든 API 호출 (컴포넌트에서 fetch 직접 호출 금지)
  lib/format.ts       업로드 사전 검사, 크기·시간·검출 등급 표시 형식
  components/         AppShell(브레드크럼·스테퍼), Modal, DistributionPathModal, ImageViewer, Icon
  pages/              Landing → Upload(분석 시작 포함) → Progress → Result
  App.tsx             화면 전환
```

## 배포 경로 3 · 5 · 7단계 확인

데모 이미지는 항상 3단계(`COPY-C203`)만 나옵니다. 개발 서버에서는 아래 주소로
`GET /api/copies/{copyCode}/path` 결과(실제 서버 데이터)를 배포 경로 모달로 띄울 수 있습니다.

- http://localhost:5173/?pathPreview=COPY-C203 (3단계)
- http://localhost:5173/?pathPreview=COPY-G407 (5단계)
- http://localhost:5173/?pathPreview=COPY-P509 (7단계)

프로덕션 빌드에서는 이 주소가 동작하지 않습니다.
