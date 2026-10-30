# TraceGuard 백엔드 API 명세 (프론트엔드용)

> 대상: `frontend/` 개발자 · 기준 브랜치: `develop` · 서버: Spring Boot `http://localhost:8080`
>
> 화면 흐름: **01 랜딩 → 02 파일 업로드 → 2.1 분석 시작 → 03 분석 진행 → 04 결과 확인 → 06 배포 경로 모달**

---

## 0. 한눈에 보기

| 화면 | 사용자 동작 | API |
|---|---|---|
| 01 랜딩 | — | 없음 (정적 화면) |
| 02 파일 업로드 | 파일 드래그 · 파일 선택 | `POST /api/files` |
| | 데모 이미지로 체험하기 | `POST /api/files/demo` |
| 2.1 분석 시작 | 파일 정보 표시 (이름 · 크기 · 해상도 · 형식) | 업로드 응답 그대로 사용 (추가 호출 없음) |
| | 미리보기 썸네일 | `GET /api/files/{fileId}/image` |
| | **분석 시작** | `POST /api/analyses` |
| | X (업로드 화면으로) | 없음 (업로드 파일은 24시간 뒤 서버가 자동 삭제) |
| 03 분석 진행 | 진행 상태 (1초 폴링) | `GET /api/analyses/{analysisId}` |
| | **분석 취소** | `DELETE /api/analyses/{analysisId}` |
| 04 결과 확인 | 결과 표시 | `GET /api/analyses/{analysisId}/result` |
| | 원본 보기 | `GET /api/files/{fileId}/image` |
| 06 배포 경로 모달 | 배포 경로 확인하기 | 결과 응답의 `path` 사용 (또는 `GET /api/copies/{copyCode}/path`) |

```
POST /api/files ─▶ (2.1 파일 정보) ─▶ POST /api/analyses ─▶ GET /api/analyses/{id} 1초 폴링
                                                          │     └─ DELETE 로 취소
                                                          ├─ COMPLETED ─▶ GET /api/analyses/{id}/result
                                                          └─ FAILED    ─▶ failureReason 으로 안내
```

---

## 1. 공통 규칙

| 항목 | 내용 |
|---|---|
| Base URL | `http://localhost:8080` (모든 경로는 `/api` 로 시작) |
| CORS | 허용 출처는 서버 환경변수 `CORS_ALLOWED_ORIGINS` (기본 `http://localhost:5173`). 다른 포트를 쓰면 백엔드에 알려주세요 |
| 인증 | 없음 (로그인 기능 없음) |
| 요청 본문 | 파일 업로드는 `multipart/form-data`, 그 외는 JSON |
| 응답 | JSON, 필드명 **camelCase** |
| 시각 | ISO-8601 문자열, 서버 시간대(Asia/Seoul) 기준, 타임존 표기 없음. 예: `"2026-10-31T03:21:45.067428"` |
| 값이 없음 | 필드는 있고 값이 `null` (예: `failureReason: null`) |

### 오류 응답

모든 오류는 HTTP 4xx/5xx + 아래 형식입니다.

```json
{ "error": "사용자에게 보여줄 수 있는 한국어 메시지", "code": "FILE_TOO_LARGE" }
```

- `error`: 그대로 화면에 띄워도 되는 메시지
- `code`: 프론트가 분기해야 하는 오류에만 붙습니다. **없으면 필드 자체가 없습니다**

| code | HTTP | 언제 | 화면 처리 예시 |
|---|---|---|---|
| `EMPTY_FILE` | 400 | 파일 없이 업로드 | "파일을 선택해주세요" |
| `INVALID_REQUEST` | 400 | 필수값 누락 · 잘못된 JSON | 메시지 표시 |
| `FILE_TOO_LARGE` | 413 | 50MB 초과 | "최대 50MB까지 올릴 수 있습니다" |
| `UNSUPPORTED_FORMAT` | 415 | PNG/JPG/JPEG 아님 (확장자 또는 실제 내용 불일치, 깨진 이미지 포함) | "PNG, JPG, JPEG 파일만 지원합니다" |
| `FILE_NOT_FOUND` | 404 | 없는 파일 / 보관 기간이 지나 삭제됨 / 취소로 삭제됨 | 업로드 화면으로 |
| `DEMO_NOT_READY` | 404 | 서버에 데모 이미지가 아직 없음 (아래 7장 실행 방법 참고) | 데모 버튼 비활성 또는 안내 |
| `ANALYSIS_NOT_FOUND` | 404 | 없는 analysisId | 업로드 화면으로 |
| `ANALYSIS_RUNNING` | 409 | 진행 중인데 결과 조회 | 폴링 계속 |
| `ANALYSIS_CANCELED` | 409 | 취소된 분석의 결과 조회 | 업로드 화면으로 |
| `ANALYSIS_FINISHED` | 409 | 이미 끝난 분석을 취소 | 무시해도 됨 |
| `NO_DOCUMENT` · `NOT_FOUND` · `NOT_REGISTERED` · `ENGINE_ERROR` · `INTERNAL_ERROR` | 409 | 실패한 분석의 결과 조회 (4.3 실패 사유) | 실패 안내 |
| `COPY_NOT_FOUND` | 404 | 없는 사본 ID | — |
| `LINEAGE_CYCLE` · `LINEAGE_BROKEN` | 409 | 배포 기록 데이터 오류 (정상 데이터에선 발생 안 함) | "배포 경로를 불러올 수 없습니다" |
| `HCK_INVALID` | 400 | .hck 보호 파일이 아니거나 형식이 다름 | "보호 파일을 다시 확인해주세요" |
| `HCK_TAMPERED` | 400 | 보호 파일 장부가 변조됨 (줄 수정 · 중간 줄 삭제 · 가짜 줄) | `error` 그대로 표시 |
| (없음) | 502 | 워터마크 엔진 연결 실패 등 | "잠시 후 다시 시도해주세요" |

---

## 2. 파일 업로드 (02 · 2.1 화면)

### 2.1 `POST /api/files` — 이미지 업로드

`multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `file` | file | O | PNG · JPG · JPEG, 최대 50MB |

- 확장자와 **실제 파일 내용(시그니처)** 을 모두 확인합니다. 확장자만 바꾼 파일은 415
- 서버는 파일을 암호화해 저장합니다 (화면의 "업로드한 파일은 암호화되어 안전하게 처리됩니다" 문구의 근거)

**201 Created**
```json
{
  "fileId": "7b694678-0d04-4fcb-a93d-fa05fde51725",
  "name": "OLED_설계도.png",
  "size": 2483021,
  "width": 1920,
  "height": 1080,
  "format": "PNG"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `fileId` | string (UUID) | 이후 모든 호출에 사용 |
| `name` | string | 사용자가 올린 원래 파일명 |
| `size` | number | 바이트. 화면의 `2.4MB` 는 프론트에서 변환 |
| `width` · `height` | number | 픽셀. 화면의 `1920 × 1080` |
| `format` | `"PNG"` \| `"JPEG"` | JPG 와 JPEG 은 모두 `"JPEG"` |

> 💡 50MB 초과는 서버도 413으로 막지만, 업로드 전에 `file.size > 50 * 1024 * 1024` 를 프론트에서 먼저 확인하면 큰 파일을 보내지 않아도 됩니다.

```ts
const form = new FormData();
form.append("file", file);
const res = await fetch(`${API}/api/files`, { method: "POST", body: form }); // Content-Type 은 직접 넣지 마세요
```

### 2.2 `POST /api/files/demo` — 데모 이미지로 체험하기

본문 없음. 서버에 준비된 데모 이미지(배포본 COPY-C203 을 촬영한 것처럼 만든 이미지)를 업로드 파일로 등록합니다.

**201 Created** — 2.1 과 같은 형식
```json
{ "fileId": "…", "name": "demo_captured.jpg", "size": 126591, "width": 1310, "height": 990, "format": "JPEG" }
```

이 파일로 분석하면 **COPY-C203 / 원본 → 직원 B → 협력사 C (3단계)** 가 나옵니다.

### 2.3 `GET /api/files/{fileId}/image` — 업로드 이미지 (미리보기 · 원본 보기)

- 응답: 이미지 바이너리 (`image/png` 또는 `image/jpeg`), `Cache-Control: no-store`
- `<img src={`${API}/api/files/${fileId}/image`} />` 로 바로 쓸 수 있습니다
- 보관 기간: 분석이 끝나고 **1시간**, 분석하지 않은 파일은 **24시간** 뒤 삭제 → 이후 404 `FILE_NOT_FOUND`. **분석을 취소하면 즉시 삭제**됩니다

---

## 3. 분석 시작 (2.1 화면)

### `POST /api/analyses`

```json
{ "fileId": "7b694678-0d04-4fcb-a93d-fa05fde51725" }
```

**202 Accepted** — 즉시 응답, 분석은 서버에서 비동기로 진행
```json
{ "analysisId": "a41a08dc-b28a-4a43-9a73-bbc187f65422" }
```

받은 `analysisId` 로 03 분석 진행 화면에 들어가 폴링을 시작하세요.

---

## 4. 분석 진행 (03 화면)

### 4.1 `GET /api/analyses/{analysisId}` — 진행 상태 (1초마다 폴링)

**200 OK**
```json
{
  "analysisId": "a41a08dc-…",
  "fileId": "7b694678-…",
  "status": "RUNNING",
  "failureReason": null,
  "failureMessage": null,
  "progress": 32,
  "elapsedMs": 1109,
  "steps": [
    { "key": "VALIDATE",  "name": "파일 검증 및 전처리",    "status": "DONE",    "progress": 100, "elapsedMs": 46 },
    { "key": "WATERMARK", "name": "워터마크 분석",          "status": "RUNNING", "progress": 28,  "elapsedMs": 1063 },
    { "key": "LOOKUP",    "name": "문서 및 배포 기록 조회", "status": "PENDING", "progress": 0,   "elapsedMs": null }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | `"RUNNING"` \| `"COMPLETED"` \| `"CANCELED"` \| `"FAILED"` | **RUNNING 이 아니면 폴링 중단** |
| `progress` | number 0~100 | 전체 진행률. COMPLETED 면 100 |
| `elapsedMs` | number | 분석 시작부터 경과 시간 (끝나면 멈춤) |
| `steps` | 배열 3개, 항상 이 순서 | 화면의 1 · 2 · 3 단계 |
| `steps[].key` | `"VALIDATE"` \| `"WATERMARK"` \| `"LOOKUP"` | |
| `steps[].name` | string | 화면에 쓰는 단계 이름 |
| `steps[].status` | `"PENDING"` \| `"RUNNING"` \| `"DONE"` | 아이콘: 대기 ○ / 진행 스피너 / 완료 ✓ |
| `steps[].progress` | number 0~100 | 단계 진행률 (화면의 `68%`) |
| `steps[].elapsedMs` | number \| null | 단계별 소요 시간 (화면의 `00:03`, `00:12`). 시작 전이면 null |
| `failureReason` · `failureMessage` | 4.3 참고 | FAILED 일 때만 값이 있음 |

**알아둘 점**
- 워터마크 분석은 엔진 호출 한 번이라 서버도 중간 진행률을 알 수 없습니다. 호출 중에는 **경과 시간으로 추정**(최대 95%)하고, 응답이 오면 100% 로 맞춥니다. 그래서 진행률이 95% 근처에서 잠시 멈췄다가 100%로 넘어갈 수 있습니다
- 실제로는 보통 **1~3초** 안에 끝납니다 (화면 문구 "약 10~30초" 보다 빠름)
- 워터마크 단계의 세부 문구(주파수 영역에서 … / 식별 정보를 … / 등록된 사본과 …)는 **API 에 없습니다**. `steps[1].progress` 구간에 따라 프론트에서 바꿔주세요
- 진행률 색상(30% 미만 회색, 30% 이상 초록)도 프론트에서 `progress` 로 판단하면 됩니다
- 엔진 오류 · 취소로 끝나면 진행 중이던 단계는 `RUNNING` 으로 남고 숫자는 멈춥니다. **단계 상태가 아니라 최상위 `status` 로 판단하세요**

### 4.2 `DELETE /api/analyses/{analysisId}` — 분석 취소

**204 No Content**

- 진행 중이면 `CANCELED` 로 바뀌고 업로드 파일이 **즉시 삭제**됩니다 → 취소 후 업로드 화면으로 돌아가 새로 올려야 합니다
- 엔진이 이미 처리 중이었다면 나중에 도착한 결과는 버립니다
- 이미 취소된 분석: 다시 204 / 이미 끝난 분석: 409 `ANALYSIS_FINISHED` (무시해도 됨)

### 4.3 실패 사유 (`status: "FAILED"`)

| failureReason | failureMessage (서버가 주는 문구) | 의미 |
|---|---|---|
| `NO_DOCUMENT` | 이미지에서 문서를 찾지 못했습니다 | 사진에서 문서 영역을 못 찾음 |
| `NOT_FOUND` | 워터마크를 검출하지 못했습니다 | 문서는 찾았지만 워터마크 없음 / 너무 손상됨 |
| `NOT_REGISTERED` | 워터마크는 검출됐지만 배포 기록에 없는 사본입니다 | 우리가 발급한 사본이 아님 |
| `ENGINE_ERROR` | 분석 엔진 오류로 분석하지 못했습니다 | 서버 쪽 문제, 재시도 |
| `INTERNAL_ERROR` | 서버 오류로 분석하지 못했습니다 | 서버 쪽 문제, 재시도 |

> 실패 화면 디자인은 아직 없습니다. `failureMessage` 를 그대로 보여주고 "다른 파일 분석하기"로 돌아가는 정도면 충분합니다.

### 폴링 예시

```ts
async function poll(analysisId: string, onUpdate: (s: AnalysisStatus) => void) {
  while (true) {
    const s: AnalysisStatus = await (await fetch(`${API}/api/analyses/${analysisId}`)).json();
    onUpdate(s);
    if (s.status !== "RUNNING") return s;   // COMPLETED → 결과 화면, FAILED → 실패 안내, CANCELED → 업로드 화면
    await new Promise((r) => setTimeout(r, 1000));
  }
}
```

---

## 5. 결과 확인 (04 화면)

### `GET /api/analyses/{analysisId}/result`

`status` 가 `COMPLETED` 일 때만 200. 그 외는 409 (`code`: `ANALYSIS_RUNNING` / `ANALYSIS_CANCELED` / 실패 사유)

**200 OK** (데모 이미지를 실제로 분석한 응답)
```json
{
  "analysisId": "a41a08dc-…",
  "copyCode": "COPY-C203",
  "recipientName": "협력사 C",
  "recipientType": "PARTNER",
  "document": { "docCode": "DOC-A001", "title": "OLED 설계도" },
  "z": 7.92,
  "threshold": 5.0,
  "detectionLevel": "HIGH",
  "via": "match",
  "analyzedAt": "2026-10-31T03:21:45.067428",
  "method": "이미지 워터마크 검출 (FFT)",
  "file": { "fileId": "7b694678-…", "name": "demo_captured.jpg", "size": 126591, "width": 1310, "height": 990, "format": "JPEG" },
  "distributionSteps": 3,
  "pathSummary": "원본 → 직원 B → 협력사 C",
  "path": [
    { "code": "DOC-A001",  "name": "OLED 설계도", "type": "ORIGINAL", "role": "원본 문서",   "recipientType": null },
    { "code": "COPY-B102", "name": "직원 B",      "type": "COPY",     "role": "중간 사본",   "recipientType": "EMPLOYEE" },
    { "code": "COPY-C203", "name": "협력사 C",    "type": "COPY",     "role": "식별된 사본", "recipientType": "PARTNER" }
  ]
}
```

화면 요소와 필드 매핑

| 화면 | 필드 |
|---|---|
| 파일명 · `2.4MB │ 1920 × 1080 │ PNG` | `file.name`, `file.size`(변환), `file.width × file.height`, `file.format` |
| 사본 ID / 식별된 사본 카드 | `copyCode` |
| 원본 문서 `OLED 설계도 (DOC-A001)` | `document.title`, `document.docCode` |
| **검출 신뢰도** | `detectionLevel` (+ 상세 보기에 `z`, `threshold`) — 아래 ⚠️ 참고 |
| 분석 일시 | `analyzedAt` (예: `2026. 10. 31. 03:21:45` 로 포맷) |
| 분석 방식 | `method` |
| 배포 단계 `3단계` | `distributionSteps` |
| `원본 → B → C` | `pathSummary` (배포 대상 이름이 들어갑니다: `원본 → 직원 B → 협력사 C`) |
| 원본 보기 | `GET /api/files/{file.fileId}/image` |
| 배포 경로 확인하기 | `path` (6장) |

> ⚠️ **검출 신뢰도는 % 가 아닙니다.** 디자인 시안의 `98.7%` 같은 확률 값은 주지 않습니다. 엔진 점수(z-score)를 근거 없이 %로 바꾸면 과장이 되기 때문입니다. 대신 등급을 줍니다.
>
> | detectionLevel | 기준 | 표시 예시 |
> |---|---|---|
> | `HIGH` | z ≥ threshold + 2 | 높음 |
> | `MEDIUM` | threshold ≤ z < threshold + 2 | 보통 |
> | `LOW` | z < threshold | 낮음 (COMPLETED 결과에선 거의 없음) |
>
> 상세 분석 보기에서는 `검출 점수 7.92 (기준 5.0)` 처럼 `z`, `threshold` 를 함께 보여주면 됩니다.

**분석 요약 (상세 분석 보기)** 의 체크 항목은 결과가 COMPLETED 면 모두 성립하므로 프론트에서 고정 문구로 표시하면 됩니다.
- 워터마크 검출 성공 / 검출된 사본 ID가 배포 기록과 일치 / 배포 경로 추적 가능

`via` 는 엔진이 어떤 방식으로 찾았는지(`coherent` · `match` · `rs`)이며 화면에 꼭 쓸 필요는 없습니다.

---

## 6. 배포 경로 모달 (06 화면)

결과 응답의 **`path` 배열을 그대로 쓰면 됩니다** (추가 호출 불필요). 따로 조회해야 하면:

### `GET /api/copies/{copyCode}/path`

**200 OK** — 결과의 `path` 와 같은 배열
```json
[
  { "code": "DOC-A001",  "name": "OLED 설계도", "type": "ORIGINAL", "role": "원본 문서",   "recipientType": null },
  { "code": "COPY-B102", "name": "직원 B",      "type": "COPY",     "role": "중간 사본",   "recipientType": "EMPLOYEE" },
  { "code": "COPY-C203", "name": "협력사 C",    "type": "COPY",     "role": "식별된 사본", "recipientType": "PARTNER" }
]
```

| 필드 | 값 | 화면 |
|---|---|---|
| 배열 순서 | 원본 → 중간 사본 … → 식별된 사본 | 위에서 아래로. `index + 1` 이 "N단계" |
| 배열 길이 | 3, 5, 7 … **고정 아님** | 카드 개수 = 길이, 화살표 = 길이 − 1, "총 N단계" |
| `code` | 원본은 docCode, 사본은 copyCode | 카드의 ID |
| `name` | 원본은 문서 제목, 사본은 배포 대상 이름 | 카드 제목 |
| `type` | `ORIGINAL` \| `COPY` | 카드 왼쪽 "원본" / "사본" |
| `role` | `원본 문서` \| `중간 사본` \| `식별된 사본` | 오른쪽 배지 (마지막 항목만 `식별된 사본` → 파란 테두리 강조) |
| `recipientType` | `null`(원본) \| `EMPLOYEE` \| `PARTNER` | 아이콘: 문서 / 사람 / 건물 |

- **배포 시각은 주지 않습니다** (모달 하단 "배포 시각 정보는 제공되지 않습니다" 문구와 일치)
- 모달 상단의 파일명 · 사본 ID 는 결과 응답의 `file.name`, `copyCode` 를 쓰세요
- 개발용 시드에는 3 · 5 · 7단계 경로가 모두 있습니다. 데모 이미지는 3단계만 나오므로, 5 · 7단계 모달은 아래 경로 API 로 확인하세요

| 길이 | 식별된 사본 | 경로 |
|---|---|---|
| 3 | `COPY-C203` | DOC-A001 → 직원 B → 협력사 C |
| 5 | `COPY-G407` | DOC-A001 → 직원 D → 협력사 E → 협력사 F → 협력사 G |
| 7 | `COPY-P509` | DOC-A001 → 직원 H → 직원 J → 협력사 K → 협력사 M → 협력사 N → 협력사 P |

---

## 7. 로컬 실행 (프론트 개발용)

레포 루트에서 (자세한 내용은 [README](../README.md) 13장):

```bash
cp .env.example .env
echo "FILE_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env   # 필수
```

1. **워터마크 엔진** (호스트에서 실행, 먼저 띄우기)
   ```bash
   python -m venv .venv && .venv/bin/pip install -r watermark/requirements.txt
   cd watermark && WM_KEY=<팀 공용 키> ../.venv/bin/python server.py   # :8000
   ```
2. **MySQL + 백엔드**
   ```bash
   docker compose up -d --build     # 로컬 3306 이 사용 중이면 .env 에 MYSQL_PORT=3307
   ```
3. 백엔드가 뜨면서 **엔진이 켜져 있으면** 시드(DOC-A001, 3 · 5 · 7단계 사본, 데모 이미지)를 자동으로 만듭니다. 엔진이 꺼져 있었다면 엔진을 켠 뒤 `docker compose restart backend`
4. 확인: `curl http://localhost:8080/api/recipients` → 12개

---

## 8. TypeScript 타입

```ts
export type ImageFormat = "PNG" | "JPEG";
export type RecipientType = "EMPLOYEE" | "PARTNER";

export interface ApiError { error: string; code?: string; }

export interface UploadedFile {
  fileId: string; name: string; size: number; width: number; height: number; format: ImageFormat;
}

export interface AnalysisCreated { analysisId: string; }

export type AnalysisStatusValue = "RUNNING" | "COMPLETED" | "CANCELED" | "FAILED";
export type FailureReason = "NO_DOCUMENT" | "NOT_FOUND" | "NOT_REGISTERED" | "ENGINE_ERROR" | "INTERNAL_ERROR";

export interface AnalysisStep {
  key: "VALIDATE" | "WATERMARK" | "LOOKUP";
  name: string;
  status: "PENDING" | "RUNNING" | "DONE";
  progress: number;          // 0~100
  elapsedMs: number | null;  // 시작 전이면 null
}

export interface AnalysisStatus {
  analysisId: string;
  fileId: string;
  status: AnalysisStatusValue;
  failureReason: FailureReason | null;
  failureMessage: string | null;
  progress: number;          // 0~100
  elapsedMs: number;
  steps: [AnalysisStep, AnalysisStep, AnalysisStep];
}

export interface PathNode {
  code: string;
  name: string;
  type: "ORIGINAL" | "COPY";
  role: "원본 문서" | "중간 사본" | "식별된 사본";
  recipientType: RecipientType | null;
}

export interface AnalysisResult {
  analysisId: string;
  copyCode: string;
  recipientName: string;
  recipientType: RecipientType;
  document: { docCode: string; title: string };
  z: number;
  threshold: number;
  detectionLevel: "HIGH" | "MEDIUM" | "LOW";
  via: string | null;
  analyzedAt: string;        // ISO-8601, 타임존 없음 (서버 KST)
  method: string;
  file: UploadedFile;
  distributionSteps: number; // = path.length
  pathSummary: string;
  path: PathNode[];
}
```

---

## 부록 A. 화면에 없는 API (관리 · 시드용)

현재 화면 설계에는 없지만 서버에 있는 API 입니다. 문서 등록 · 사본 발급 화면을 만들 때 사용합니다.

| API | 설명 |
|---|---|
| `POST /api/documents` (multipart: `title`, `image`?) | 원본 문서 등록 → `{docCode, title, width, height, createdAt}` |
| `POST /api/documents/{docCode}/copies` (multipart: `name`, `recipientType`, `parentCopyCode`?) | 배포 대상별 워터마크 사본 발급 (엔진 호출, 1~2초) → `{copyCode, recipientId, parentCopyCode, psnr, ssim, fileUrl, …}` |
| `GET /api/copies/{copyCode}/file` (`?download=1` 이면 다운로드) | 배포본 PNG |
| `GET /api/recipients` | 사본 대장 목록 `[{recipientId, copyCode, parentCopyCode, docCode, name, recipientType, width, height, createdAt}]` |
| `POST /api/detections` (multipart: `photo`, `corners`?) | 예전 동기 검출 API (화면 흐름에서는 `/api/analyses` 사용) |

## 부록 C. 보호 파일 (.hck) — 플랫폼 밖 전달 추적

사본을 PNG 대신 `.hck` 로 보내면, 받은 사람이 카톡 · 이메일로 다시 넘겨도 **여는 사람마다** 기록됩니다.

```
유기현이 .hck 를 카톡으로 C 에게 전송
 → C 는 웹 뷰어(#viewer)에서만 열 수 있음 (파일에는 이미지가 없고 서명된 장부만 있음)
 → 여는 순간 서버가 장부 검증 → C 전용 워터마크 사본 발급(부모 = 유기현 사본) → 장부에 한 줄 추가
 → C 가 화면을 찍어 유출해도 사진에서 C 의 사본이 검출 → 배포 경로: 원본 → 유기현 → C
```

### `GET /api/copies/{copyCode}/hck` — 보호 파일 내려받기

`application/x-hck`, `Content-Disposition: attachment; filename="COPY-XXXX.hck"`.
zip 안에 `manifest.json`(`format`, `version`, `docCode`, `title`)과 `ledger.json`(원본 → 이 사본까지의 등록된 배포 경로)이 들어 있습니다.

### `POST /api/hck/open` — 보호 파일 열기 (multipart)

| 필드 | 필수 | 설명 |
|---|---|---|
| `file` | O | `.hck` |
| `name` | O | 열람자 이름 (워터마크 사본의 받는 사람) |
| `recipientType` | | `EMPLOYEE` \| `PARTNER` (기본 `PARTNER`) |
| `viewerId` | 권장 | 브라우저가 보관하는 기기 식별값. 같은 기기가 다시 열면 새 사본을 만들지 않음 |

**200 OK**
```json
{
  "hckBase64": "…",                 // 장부가 갱신된 새 .hck → 같은 파일에 덮어쓰거나 내려받기
  "docCode": "DOC-A001", "title": "OLED 설계도",
  "copyCode": "COPY-V052",          // 열람자 사본. 화면 이미지는 GET /api/copies/{copyCode}/file
  "name": "협력사 C",
  "parentCopyCode": "COPY-D749", "parentName": "유기현",   // 파일을 넘겨준 사람 (내 사본이면 null)
  "reopened": false,                // 같은 기기 재열람 · 사본 주인이 처음 연 경우 true (새 사본 없음)
  "imageUrl": "/api/copies/COPY-V052/file",
  "ledger": [
    { "seq": 0, "event": "ISSUE", "copyCode": "COPY-D749", "name": "유기현",   "recipientType": "EMPLOYEE" },
    { "seq": 1, "event": "CLAIM", "copyCode": "COPY-D749", "name": "유기현",   "recipientType": "EMPLOYEE" },
    { "seq": 2, "event": "OPEN",  "copyCode": "COPY-V052", "name": "협력사 C", "recipientType": "PARTNER" }
  ]
}
```

| event | 의미 |
|---|---|
| `ISSUE` | 플랫폼에서 발급된 사본 (내려받을 때의 배포 경로) |
| `CLAIM` | 사본 주인이 처음 열어 기기를 연결 (이름이 사본 받는 사람과 같을 때, 새 사본 없음) |
| `OPEN` | 다른 사람이 열어 열람자 사본을 발급 |

- 장부 줄: `hash = SHA-256(앞 줄 hash + 본문)`, `sig = HMAC-SHA256(서버 키, hash)`. 서명 키는 `FILE_ENCRYPTION_KEY` 에서 파생 (서버를 옮겨도 같은 키를 써야 기존 .hck 가 열림)
- 기기 식별값은 원래 값 대신 서버 키로 만든 짧은 값만 장부에 남깁니다

### 한계
- 뷰어로 열지 않고 넘어간 경로(파일만 전달하고 아무도 열지 않음)는 그 다음 열람자의 부모로 합쳐집니다
- 장부의 **끝 줄만 잘라낸 파일**은 정상적인 분기(같은 파일을 여러 명에게 보냄)와 구별할 수 없어 막지 못합니다. 서버 사본 대장에는 잘라낸 사람의 사본도 남습니다
- 열람자 신원은 입력값 (본인 인증 없음, PoC). 배포본 이미지(`/file`)는 사본 ID 만 알면 조회됩니다

## 부록 B. 서버 동작 메모

- 업로드 파일은 AES-256-GCM 으로 암호화되어 UUID 이름으로 저장, 원래 파일명은 DB 에만 저장
- 업로드 파일 보관: 분석 완료 · 실패 후 1시간, 미분석 24시간, 취소 시 즉시 삭제
- 분석 결과는 검출 이력(Detection)으로도 남습니다
- 사본 워터마크는 항상 원본 문서 이미지에 삽입되고, 부모 사본은 배포 기록용입니다
- 기록되지 않은 전달 경로는 복원하지 않으며, 결과는 실제 유출자를 확정하지 않습니다
