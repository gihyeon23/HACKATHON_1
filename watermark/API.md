# API 계약

```
[frontend] ──/api──▶ [backend: Spring Boot :8080] ──/v1──▶ [engine: Python :8000]
                       이름·대장·파일 저장                    stateless, ID만 처리
```

- frontend ↔ backend: `/api/*` (현재는 `dev/mock_backend.py`가 같은 계약으로 대체)
- backend ↔ engine: `/v1/*` (내부망 전용, 외부 노출 금지)
- 비밀키(`WM_KEY`)는 엔진만 보유. 이름은 엔진으로 전달하지 않음
- 모든 요청은 `multipart/form-data`, 응답은 JSON (camelCase)
- 오류: HTTP 4xx/5xx + `{"error": "메시지"}`

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

## Backend (`/api`)

### `POST /api/documents` — 수신자별 사본 발급
| 필드 | 타입 | 필수 |
|---|---|---|
| `name` | string | O |
| `image` | file | |

백엔드: 고유 `recipientId` 발급 → `/v1/embed` 호출 → PNG 저장 → 대장 등록

응답
```json
{"recipientId": 2624297755, "name": "홍길동", "psnr": 37.2, "ssim": 0.955, "elapsedMs": 2100.0,
 "strength": 4.0, "predictedZ": 6.6, "threshold": 5.0,
 "fileUrl": "/api/documents/2624297755/file"}
```

### `GET /api/documents/{recipientId}/file`
PNG. `?download=1`이면 첨부 다운로드

### `POST /api/detections` — 유출자 검출
| 필드 | 타입 | 필수 |
|---|---|---|
| `photo` | file | O |
| `corners` | string | |

백엔드: 대장에서 후보 목록 구성 + 문서별 배포본 1장을 `reference`로 첨부 → `/v1/detect` 호출 → ID를 이름으로 변환

응답: `/v1/detect` 응답 + `name`, `ranking[].name` (ID 대신 이름)

### `GET /api/recipients`
```json
[{"recipientId": 2624297755, "name": "홍길동", "width": 1024, "height": 768, "createdAt": "2026-10-31 00:10:00"}]
```
