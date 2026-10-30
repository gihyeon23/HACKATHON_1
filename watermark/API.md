# API 계약

```
[frontend] ──/api──▶ [backend: Spring Boot :8080] ──/v1──▶ [engine: Python :8000]
                       이름·대장·파일 저장                    stateless, ID만 처리
```

- frontend ↔ backend: `/api/*`
- backend ↔ engine: `/v1/*` (내부망 전용, 외부 노출 금지)
- 비밀키(`WM_KEY`)는 엔진만 보유. 이름은 엔진으로 전달하지 않음
- 모든 요청은 `multipart/form-data`, 응답은 JSON (camelCase)
- 오류: HTTP 4xx/5xx + `{"error": "메시지"}` (백엔드는 구분이 필요한 오류에 `"code"`를 함께 준다)

---

## Engine (`/v1`)

### `GET /health`
`{"status": "ok"}`

### `POST /v1/embed`
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `recipientId` | int | O | 32bit 수신자 ID (0 ~ 2^32-1, 백엔드가 발급) |
| `image` | file | | 문서 이미지. 없으면 샘플 문서 |
| `strength` | float | | 삽입 강도. 생략 시 **자동**: 촬영 시뮬레이션 예상 z ≥ 6.5가 되는 최소 강도 (3.0~5.0) |
| `maxSide` | int | | 긴 변 제한 (기본 1600) |

응답
```json
{
  "recipientId": 2624297755,
  "width": 1024, "height": 768,      // 테두리 제외 원본 크기 → 백엔드가 저장 (검출 시 필요)
  "frame": 12,                        // 검은 테두리 두께(px)
  "strength": 4.0,                    // 적용된 강도
  "predictedZ": 6.6, "threshold": 5.0,  // 촬영 시뮬레이션 예상 z / 판정 임계
  "psnr": 37.2, "ssim": 0.955, "elapsedMs": 2100.0,
  "imagePng": "<base64>"              // 테두리 포함 배포용 PNG
}
```

### `POST /v1/detect`
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `photo` | file | O | 촬영본 |
| `candidates` | JSON string | O | `[{"id": int, "width": int, "height": int}]` 배포 대상 목록 |
| `reference` | file (복수) | 권장 | 기준 이미지: 배포본 PNG(테두리 포함). 문서별 1장, 최대 10장 |
| `corners` | string | | 수동 코너 `x1,y1,x2,y2,x3,y3,x4,y4` (좌상→우상→우하→좌하) |

정렬 우선순위: `corners`(수동) → `reference` 특징점 정렬 → 검은 테두리 검출(예비).
`reference`로 정렬되면 후보별 예상 워터마크와 위상까지 직접 상관하는 정보 결합 검출을 추가로 수행 (훨씬 민감, 구버전 배포본도 검출).
테두리 검출은 문서가 화면을 꽉 채우면 베젤과 합쳐져 실패할 수 있으므로 `reference` 전달을 권장.

응답 (성공)
```json
{
  "found": true,
  "recipientId": 2624297755,
  "via": "coherent",                  // coherent: 정보 결합 상관(기준 이미지 정렬 시) | match: 에너지 매칭 | rs: RS 복호 | null
  "version": "v2",                    // coherent일 때 삽입 파라미터 버전 (v1: 구버전 배포본)
  "alignment": "reference",           // reference: 기준 이미지 정렬 | frame: 테두리 검출 | manual: 수동
  "z": 7.7, "z2": 0.1, "threshold": 5.0,
  "ranking": [{"id": 2624297755, "z": 7.7}, {"id": 1309005247, "z": 0.1}],
  "corners": [[654.4, 473.5], [3520.1, 424.3], [3433.2, 2495.2], [781.7, 2539.8]],
  "scale": 1.0, "elapsedMs": 350.2,
  "restoredJpeg": "<base64>"          // 원근 보정 결과 미리보기
}
```

응답 (문서 테두리 미검출, HTTP 200)
```json
{"found": false, "error": "NO_DOCUMENT", "elapsedMs": 120.0}
```

---

## Ba## Backend (`/api`)

- 응답은 JSON camelCase. 시각은 ISO-8601 (`2026-10-31T00:10:00`)
- 오류: `{"error": "메시지", "code": "코드"}` — `code`는 프론트가 분기해야 하는 오류에만 붙는다 (없으면 생략)
- 엔진 호출 실패는 502 (`{"error": "엔진 오류: ..."}`)

### 오류 코드
| code | HTTP | 의미 |
|---|---|---|
| `EMPTY_FILE` | 400 | 파일 없음 |
| `INVALID_REQUEST` | 400 | 필수값 누락·형식 오류 |
| `FILE_TOO_LARGE` | 413 | 50MB 초과 |
| `UNSUPPORTED_FORMAT` | 415 | PNG/JPG/JPEG 아님 (확장자·파일 시그니처 불일치, 읽을 수 없는 이미지 포함) |
| `FILE_NOT_FOUND` / `DOCUMENT_NOT_FOUND` / `COPY_NOT_FOUND` / `ANALYSIS_NOT_FOUND` | 404 | 대상 없음 (업로드 파일은 보관 기간이 지나 삭제된 경우 포함) |
| `DEMO_NOT_READY` | 404 | 데모 이미지가 아직 없음 (dev 시드 필요) |
| `LINEAGE_CYCLE` | 409 | 배포 기록에 순환 참조 |
| `LINEAGE_BROKEN` | 409 | 원본 문서와 연결되지 않은 사본 |
| `ANALYSIS_RUNNING` / `ANALYSIS_CANCELED` / `ANALYSIS_FINISHED` | 409 | 결과 조회·취소할 수 없는 상태 |
| `NO_DOCUMENT` / `NOT_FOUND` / `NOT_REGISTERED` / `ENGINE_ERROR` / `INTERNAL_ERROR` | 409 | 실패한 분석의 결과 조회 (아래 실패 사유) |

---

### 문서 · 사본

#### `POST /api/documents` — 원본 문서 등록 (multipart)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `title` | string | O | 문서 제목 |
| `image` | file | | PNG/JPG. 없으면 사본 발급 시 엔진의 샘플 문서 사용 |

201
```json
{"docCode": "DOC-A001", "title": "OLED 설계도", "width": 1024, "height": 768, "createdAt": "2026-10-31T00:10:00"}
```

#### `POST /api/documents/{docCode}/copies` — 사본 발급 (multipart)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string | O | 배포 대상 이름 |
| `recipientType` | string | O | `EMPLOYEE` \| `PARTNER` |
| `parentCopyCode` | string | | 이 사본을 넘겨준 부모 사본 (같은 문서여야 함). 없으면 원본에서 바로 발급 |

백엔드: 고유 32bit `recipientId` 발급 → `/v1/embed`(원본 문서 이미지) → 배포본 PNG 저장 → 대장 등록

201
```json
{"copyCode": "COPY-C203", "recipientId": 2624297755, "docCode": "DOC-A001", "name": "협력사 C",
 "recipientType": "PARTNER", "parentCopyCode": "COPY-B102", "width": 1024, "height": 768,
 "strength": 4.0, "predictedZ": 6.6, "threshold": 5.0, "psnr": 37.2, "ssim": 0.955, "elapsedMs": 2100.0,
 "fileUrl": "/api/copies/COPY-C203/file"}
```

#### `GET /api/copies/{copyCode}/file`
배포본 PNG. `?download=1`이면 첨부(`Content-Disposition: attachment`)

#### `GET /api/copies/{copyCode}/path` — 배포 경로
식별된 사본에서 부모를 따라 원본 문서까지 거슬러 올라간다. 순서는 **원본 문서 → 중간 사본 → 식별된 사본**, 길이는 기록된 만큼 (고정 아님). 배포 시각은 넣지 않는다.
```json
[
  {"code": "DOC-A001",  "name": "OLED 설계도", "type": "ORIGINAL", "role": "원본 문서"},
  {"code": "COPY-B102", "name": "직원 B",      "type": "COPY",     "role": "중간 사본"},
  {"code": "COPY-C203", "name": "협력사 C",    "type": "COPY",     "role": "식별된 사본"}
]
```
순환 참조면 409 `LINEAGE_CYCLE`

#### `GET /api/recipients` — 대장 목록
```json
[{"recipientId": 2624297755, "copyCode": "COPY-C203", "parentCopyCode": "COPY-B102", "docCode": "DOC-A001",
  "name": "협력사 C", "recipientType": "PARTNER", "width": 1024, "height": 768, "createdAt": "2026-10-31T00:10:00"}]
```

---

### 업로드 → 분석 → 결과

```
POST /api/files ──▶ (파일 정보 확인) ──▶ POST /api/analyses ──▶ GET /api/analyses/{id} 1초 폴링
                                                              │   (DELETE 로 취소)
                                                              └─ COMPLETED ──▶ GET /api/analyses/{id}/result
```

#### `POST /api/files` — 유출 의심 이미지 업로드 (multipart `file`)
- PNG, JPG, JPEG만 (확장자 + 파일 시그니처 확인), 최대 50MB
- 디스크에는 UUID 이름 + AES-256-GCM 암호화로 저장, 원래 이름은 DB에만

201
```json
{"fileId": "3f1c…", "name": "leak.jpg", "size": 2483021, "width": 4032, "height": 3024, "format": "JPEG"}
```
`format`: `PNG` | `JPEG`

#### `POST /api/files/demo`
서버에 준비된 데모 촬영 이미지를 업로드 파일로 등록. 응답은 `POST /api/files`와 같다 (`name`: `demo_captured.jpg`)

#### `GET /api/files/{fileId}/image`
업로드 원본 이미지 ('원본 보기'). 삭제된 파일은 404 `FILE_NOT_FOUND`

#### `POST /api/analyses` — 분석 시작 (JSON)
```json
{"fileId": "3f1c…"}
```
202 — 즉시 응답, 분석은 비동기로 진행
```json
{"analysisId": "a9e2…"}
```

#### `GET /api/analyses/{analysisId}` — 진행 상태
```json
{
  "analysisId": "a9e2…", "fileId": "3f1c…",
  "status": "RUNNING",                 // RUNNING | COMPLETED | CANCELED | FAILED
  "failureReason": null, "failureMessage": null,
  "progress": 47, "elapsedMs": 2310,
  "steps": [
    {"key": "VALIDATE",  "name": "파일 검증 및 전처리",     "status": "DONE",    "progress": 100},
    {"key": "WATERMARK", "name": "워터마크 분석",           "status": "RUNNING", "progress": 46},
    {"key": "LOOKUP",    "name": "문서 및 배포 기록 조회",  "status": "PENDING", "progress": 0}
  ]
}
```
- `steps[].status`: `PENDING` | `RUNNING` | `DONE`
- `progress` = 단계 진행률의 가중합 (파일 검증 10, 워터마크 80, 기록 조회 10). COMPLETED면 100
- 워터마크 분석은 엔진 호출 한 번이라 중간 진행률을 알 수 없어, 호출 중에는 `95 × (1 − e^(−t/3초))`로 추정하고 응답이 오면 100으로 맞춘다

실패 사유 (`status: FAILED`)
| failureReason | 의미 |
|---|---|
| `NO_DOCUMENT` | 이미지에서 문서를 찾지 못함 |
| `NOT_FOUND` | 워터마크 미검출 |
| `NOT_REGISTERED` | 워터마크는 검출됐지만 대장(배포 기록)에 없는 ID |
| `ENGINE_ERROR` | 엔진 호출 실패 |
| `INTERNAL_ERROR` | 파일 읽기 등 서버 오류 |

#### `DELETE /api/analyses/{analysisId}` — 취소
204. 진행 중이면 `CANCELED`로 바꾸고 업로드 파일을 즉시 삭제. 엔진 호출 중이었다면 나중에 도착한 결과는 버린다 (검출 이력도 남기지 않음). 이미 취소된 분석은 그대로 204, 끝난 분석은 409 `ANALYSIS_FINISHED`

#### `GET /api/analyses/{analysisId}/result` — 결과 (COMPLETED일 때만)
```json
{
  "analysisId": "a9e2…",
  "copyCode": "COPY-C203", "recipientName": "협력사 C", "recipientType": "PARTNER",
  "document": {"docCode": "DOC-A001", "title": "OLED 설계도"},
  "z": 7.7, "threshold": 5.0, "detectionLevel": "HIGH", "via": "coherent",
  "analyzedAt": "2026-10-31T00:12:03",
  "method": "이미지 워터마크 검출 (FFT)",
  "file": {"fileId": "3f1c…", "name": "leak.jpg", "size": 2483021, "width": 4032, "height": 3024, "format": "JPEG"},
  "distributionSteps": 3,
  "pathSummary": "원본 → 직원 B → 협력사 C",
  "path": [ /* GET /api/copies/{copyCode}/path 와 같은 배열 */ ]
}
```
- 신뢰도를 확률(%)로 바꾸지 않고 엔진의 `z`, `threshold`를 그대로 준다. `detectionLevel`: `z ≥ threshold+2` → `HIGH`, `z ≥ threshold` → `MEDIUM`, 그 외 `LOW`
- `distributionSteps`(= `path` 길이, 원본 포함)와 `pathSummary`는 경로 API와 같은 로직으로 계산
- RUNNING / CANCELED / FAILED면 409 (`code`: `ANALYSIS_RUNNING` / `ANALYSIS_CANCELED` / 실패 사유)

---

### 기존 API

#### `POST /api/detections` — 유출자 검출 (동기, multipart `photo`, `corners`)
백엔드: 대장에서 후보 목록 구성 → `/v1/detect` 호출 → ID를 이름으로 변환. 응답: `/v1/detect` 응답 + `name`, `ranking[].name`

---

### 가정 (구현하면서 정한 것)
1. **사본 워터마크 입력**: 부모 사본 이미지가 아니라 항상 **원본 문서 이미지**에 삽입한다 (워터마크가 겹쳐 쌓이지 않도록). 부모는 계보 기록용
2. **ID 형식**: `docCode`는 `DOC-A001`부터 순번, `copyCode`는 `COPY-[A-Z]\d{3}` 무작위(중복 시 재생성), `recipientId`는 `SecureRandom` 32bit(중복 시 재생성)
3. **원본 이미지 선택**: `POST /api/documents`의 `image`는 선택. 없으면 엔진 샘플 문서로 사본을 만든다 (시드가 이 방식)
4. **계보 컬럼 nullable**: Recipient의 `document`, `copyCode` 등은 기존 데이터 호환을 위해 DB에서 nullable. 새 사본은 서비스에서 필수로 채운다. 계보가 없는 예전 대장 항목이 검출되면 `NOT_REGISTERED`
5. **분석 실패 표현**: 문서 미검출·워터마크 미검출·미등록도 `status: FAILED` + `failureReason`으로 표현하고, 이 경우에도 검출 이력(Detection)은 남긴다. 엔진 오류·취소는 이력을 남기지 않는다
6. **기준 이미지**: 분석 시 문서별 최신 배포본 1장씩(최대 10장)을 `/v1/detect`의 `reference`로 보낸다
7. **취소**: 진행 중인 엔진 HTTP 호출 자체는 끊지 않는다. 상태만 CANCELED로 바꾸고 결과를 버린다
8. **멈춘 단계 표시**: 엔진 오류·취소로 끝나면 진행 중이던 단계는 `RUNNING`으로 남고 진행률은 끝난 시각 기준으로 고정된다 (전체 상태는 `status`로 판단)
9. **파일 보관**: 분석이 끝난(COMPLETED·FAILED) 업로드 파일은 1시간 뒤, 분석하지 않은 업로드 파일은 24시간 뒤 스케줄러(1분 주기)가 삭제. 취소된 분석의 파일은 즉시 삭제
10. **암호화 범위**: 업로드 파일만 AES-256-GCM으로 암호화(`IV 12바이트 + 암호문`). 원본 문서·배포본 PNG는 평문 저장. 키(`FILE_ENCRYPTION_KEY`)가 없으면 기동 실패
11. **데모 이미지**: dev 시드가 `COPY-C203` 배포본에 회전·기울임·블러·JPEG 85 압축을 적용해 백엔드(Java2D)에서 만든다. 엔진의 `capture_sim.py`(원근·모아레 포함)보다 약한 변형이다
12. **용량 제한**: 파일 50MB, 멀티파트 요청 전체 55MB (경계·다른 필드 여유분)
13. **경로 길이**: `distributionSteps`는 원본 문서를 포함한 경로 배열 길이 (DOC-A001 → B → C = 3)
14. **기존 `/api/documents` 계약 변경**: 예전 "수신자 사본 발급"(`POST /api/documents`, `name`)은 `POST /api/documents/{docCode}/copies`로, `GET /api/documents/{recipientId}/file`은 `GET /api/copies/{copyCode}/file`로 바뀌었다
