# AGENTS.md — ReTrace 프론트엔드 작업 규칙

> AI 코딩 도구(Claude Code, Cursor, Codex 등)와 사람이 함께 읽는 규칙입니다. **코드를 쓰기 전에 끝까지 읽으세요.**
> 이 파일과 [`docs/API_SPEC.md`](../docs/API_SPEC.md)가 충돌하면 API 명세서가 우선입니다.

## 1. 프로젝트 한 줄 요약

유출 의심 이미지를 올리면 → 워터마크로 **배포 사본**을 식별하고 → 원본 문서까지의 **등록된 배포 경로**를 보여주는 웹 화면.
흐름: **랜딩 → 파일 업로드 → 분석 시작(파일 확인) → 분석 진행 → 결과 확인 → 배포 경로 모달**

## 2. 스택

| 항목 | 결정 |
|---|---|
| 프레임워크 | React 19 + Vite |
| 언어 | TypeScript (`src/api/types.ts` = 명세서 8장 타입) |
| 스타일링 | 일반 CSS 한 파일 (`src/styles.css`), 폰트 Pretendard |
| 라우팅 | 없음 — `App.tsx` 의 화면 상태로 전환 |
| 서버 상태 / 폴링 | 라이브러리 없음 — `fetch` + `AbortController`, `setTimeout` 1초 폴링 |
| 패키지 매니저 | npm |
| 개발 서버 포트 | `5173` (백엔드 CORS 기본 허용 출처. 바꾸면 백엔드 `CORS_ALLOWED_ORIGINS` 도 바꿔야 함) |
| 디자인 | Figma: https://www.figma.com/design/7Prp3tIq5KXj583V9inMd3/ |

**AI 도구는 위 표에 없는 라이브러리를 마음대로 추가하지 마세요.** 필요하면 먼저 제안하고 사람이 결정합니다.

## 3. 작업 범위

- 작업 위치는 **`frontend/` 안만**. `backend/`, `watermark/`, `tracing/`, `docker-compose.yml` 은 수정하지 않습니다
- 브라우저는 **백엔드 `/api` 만** 호출합니다. 워터마크 엔진(`/v1`)을 직접 부르지 않습니다
- API 응답 구조가 화면에 안 맞으면 프론트에서 구조를 가정·변형하지 말고 백엔드 담당에게 요청합니다
- 로그인 기능은 만들지 않습니다. 랜딩 상단에는 로고만 두고, 시안의 메뉴(제품소개 · 주요기능 · 도입효과 · 보안기술 · 고객사례)와 "무료로 시작하기"는 **넣지 않습니다**

## 4. API 사용 규칙

- 명세: [`docs/API_SPEC.md`](../docs/API_SPEC.md). 요청·응답 타입은 명세서 8장의 TypeScript 타입을 **그대로 복사해서** 한 파일(예: `src/api/types.ts`)에 둡니다
- API 주소는 환경변수로 받습니다 (예: Vite 면 `VITE_API_BASE_URL=http://localhost:8080`). 코드에 하드코딩하지 않습니다
- API 호출은 한 곳(예: `src/api/`)에 모으고, 컴포넌트에서 `fetch` 를 직접 부르지 않습니다
- 파일 업로드는 `FormData` 에 `file` 필드로 넣고, **`Content-Type` 헤더를 직접 지정하지 않습니다**
- 오류 응답은 `{ error: string, code?: string }`. **분기는 `code` 로**, 사용자에게 보여줄 문구는 `error` 를 그대로 써도 됩니다. `code` 가 없을 수 있습니다

### 꼭 지킬 것 (AI 가 자주 틀리는 부분)

1. **검출 신뢰도를 % 로 만들지 않습니다.** 서버는 확률을 주지 않습니다. `detectionLevel`(`HIGH` · `MEDIUM` · `LOW`)을 등급으로 표시하고, 상세에서만 `z` 와 `threshold` 를 "검출 점수 7.92 (기준 5.0)" 처럼 보여줍니다. 시안의 `98.7%` 를 따라 하지 마세요
2. **배포 경로 길이를 고정하지 않습니다.** 카드 수 = `path.length`, 화살표 수 = `path.length - 1`, "N단계" = 배열 index + 1. 3 · 5 · 7단계 모두 같은 코드로 그려야 합니다
3. **폴링 종료 조건은 최상위 `status`** 입니다. `status !== "RUNNING"` 이면 멈춥니다. 단계별 `steps[].status` 로 종료를 판단하지 않습니다 (취소·오류 시 단계는 RUNNING 으로 남을 수 있음)
4. **배포 시각은 표시하지 않습니다.** 서버가 주지 않습니다
5. **mock 데이터를 실제 결과처럼 보여주지 않습니다.** mock 을 쓰면 화면에 "DEMO 데이터" 표시를 붙이고, 타이머로 만든 가짜 진행률을 서버 진행률처럼 보이게 하지 않습니다
6. **기록에 없는 경로를 추정하거나 실제 유출자로 단정하지 않습니다.** 결과·모달에 "등록된 배포 계보이며 실제 유출자를 확정하지 않습니다" 안내를 유지합니다
7. 화면을 떠나거나 취소하면 **폴링 타이머와 진행 중인 요청을 정리**합니다 (늦게 도착한 응답이 화면을 바꾸지 않게)

## 5. 화면별 규칙

### 파일 업로드
- 드래그 앤 드롭과 "파일 선택" 버튼 모두 `POST /api/files`
- PNG · JPG · JPEG, 최대 50MB. **업로드 전에** 확장자와 `file.size > 50 * 1024 * 1024` 를 먼저 검사하고, 서버의 415 `UNSUPPORTED_FORMAT` / 413 `FILE_TOO_LARGE` 도 처리합니다
- "데모 이미지로 체험하기" → `POST /api/files/demo`. 404 `DEMO_NOT_READY` 면 안내 문구를 보여줍니다
- 파일이 1개라도 올라가면 "분석 시작" · "다른 파일 선택" 버튼이 나타납니다

### 분석 시작 (파일 확인)
- 업로드 응답(`name`, `size`, `width`, `height`, `format`)으로 파일 정보를 표시합니다. 미리보기는 `GET /api/files/{fileId}/image`
- 파일 크기는 바이트로 오므로 `2.4MB` 처럼 변환은 프론트에서 합니다
- "분석 시작" → `POST /api/analyses` → 받은 `analysisId` 로 분석 진행 화면 이동
- X → 파일 업로드 화면 (API 호출 없음)

### 분석 진행
- `GET /api/analyses/{analysisId}` 를 **1초마다** 폴링합니다
- 단계 3개는 `steps` 배열 순서 그대로: 파일 검증 및 전처리 → 워터마크 분석 → 문서 및 배포 기록 조회
- 단계 아이콘은 `steps[].status` (`PENDING` / `RUNNING` / `DONE`), 단계 시간(`00:03`)은 `steps[].elapsedMs`(시작 전이면 `null` → `-` 표시)
- 진행률 색상: **30% 미만 회색, 30% 이상 초록색**
- 워터마크 단계의 세부 문구("주파수 영역에서 …" 등)는 API 에 없으므로 `steps[1].progress` 구간으로 프론트에서 바꿉니다
- 진행률이 95% 부근에서 잠시 멈췄다가 100% 로 넘어갈 수 있습니다 (서버가 엔진 호출 중에는 시간으로 추정하기 때문). 정상입니다
- "분석 취소" → `DELETE /api/analyses/{analysisId}` → 파일 업로드 화면으로. **취소하면 서버가 업로드 파일을 바로 지우므로** 다시 올려야 합니다
- `COMPLETED` → 결과 확인 화면, `FAILED` → `failureMessage` 를 보여주고 다시 업로드할 수 있게, `CANCELED` → 업로드 화면

### 결과 확인
- `GET /api/analyses/{analysisId}/result` (COMPLETED 일 때만 200)
- 화면 요소 ↔ 필드 매핑은 명세서 5장 표를 따릅니다. 배포 단계는 `distributionSteps`, 요약은 `pathSummary`
- 분석 일시 `analyzedAt` 은 타임존 없는 서버(KST) 시각 문자열입니다. `new Date()` 로 UTC 변환하지 말고 표시용으로만 포맷합니다
- "원본 보기" → `GET /api/files/{file.fileId}/image` (분석 후 1시간이 지나면 404 → 안내)
- "상세 분석 보기" → 분석 요약 목록 펼치기 (COMPLETED 면 고정 문구 3개)
- "다른 파일 분석하기" → 파일 업로드 화면
- "배포 경로 확인하기" → 배포 경로 모달 열기
- 실패 사유별 안내(`NO_DOCUMENT` · `NOT_FOUND` · `NOT_REGISTERED` · `ENGINE_ERROR` · `INTERNAL_ERROR`)는 디자인이 아직 없습니다. `failureMessage` 를 그대로 보여주는 것으로 시작합니다

### 배포 경로 모달
- 데이터는 **결과 응답의 `path` 를 그대로** 씁니다 (추가 호출 불필요). 단독 조회가 필요하면 `GET /api/copies/{copyCode}/path`
- 카드: 왼쪽 "N단계" + `type`(ORIGINAL → "원본", COPY → "사본"), 제목 `name`, 부제 `code`, 오른쪽 배지 `role`
- 아이콘: `recipientType` 이 `null` → 문서, `EMPLOYEE` → 사람, `PARTNER` → 건물
- **마지막 항목(식별된 사본)만** 파란 테두리로 강조
- 상단: "문서 배포 경로", 파일명(`file.name`), 사본 ID(`copyCode`), 닫기(X). 하단: 실제 유출자를 확정하지 않는다는 안내 + "배포 시각 정보는 제공되지 않습니다"
- 모달 높이 최대 화면의 85%, **경로 목록만** 내부 스크롤 (짧으면 스크롤바 없음), 상단·하단 고정
- 열리면 배경 스크롤 잠금, X · ESC 로 닫기, 닫으면 결과 화면 그대로 유지
- 모달 안에는 다른 버튼이나 노드 클릭 기능을 넣지 않습니다 (읽기 전용)
- 3 · 5 · 7단계를 모두 확인합니다: `COPY-C203`(3), `COPY-G407`(5), `COPY-P509`(7)

## 6. 로컬 개발

```bash
# 레포 루트에서 (자세한 내용은 docs/API_SPEC.md 7장)
cp .env.example .env && echo "FILE_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
docker compose up -d --build        # MySQL + 백엔드 :8080 (엔진은 호스트에서 먼저 실행)
curl http://localhost:8080/api/recipients   # 시드 12개 나오면 준비 완료
```

- 데모 이미지로 분석하면 항상 `COPY-C203` / 3단계가 나옵니다
- 백엔드가 안 떠 있을 때만 mock 을 쓰고, 5장 규칙대로 DEMO 표시를 붙입니다

## 7. Git 규칙 (레포 공통)

- 작업마다 GitHub 이슈 → 브랜치 → PR. 제목은 `<타입>: <설명>` (타입: feat / fix / chore / refactor / docs / test), 한국어
- 브랜치: `<타입>/#<이슈번호>-<짧은-설명>` (예: `feat/#19-analysis-progress`)
- 커밋: `<타입>: <설명> (#<이슈번호>)`
- **PR base 는 `develop`** (main 아님). 본문은 `## 관련 이슈` / `## 작업 내용` / `## 확인 사항`
- `.env`, 빌드 결과물, `node_modules` 는 커밋하지 않습니다

## 8. 완료 전 확인

- [ ] 타입 체크 · 린트 · 빌드 통과
- [ ] 실제 백엔드에 붙여 업로드 → 분석 → 결과 → 모달까지 한 번 끝까지 진행
- [ ] 분석 취소, 형식 오류, 50MB 초과, 실패 결과 확인
- [ ] 배포 경로 3 · 5 · 7단계 모달 확인
- [ ] 화면에 % 신뢰도, 배포 시각, DEMO 표시 없는 mock 값이 없는지 확인
