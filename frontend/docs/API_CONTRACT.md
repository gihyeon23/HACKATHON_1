# Page 4–6 제안 API 계약

> **이전 UI 초안의 참고 문서입니다.** develop의 공식 계약은 [docs/API_SPEC.md](../../docs/API_SPEC.md)입니다. 아래 제안 형식과 현재 클라이언트는 공식 계약과 다르며 후속 수정이 필요합니다. 아래 JSON을 백엔드의 실제 응답으로 사용하지 마세요.

백엔드와 최종 합의 전인 프런트엔드 DTO입니다. 기존 `/api/detections` 응답을 이 계약으로 간주하지 않습니다. 정확한 타입은 `src/features/investigation/types.ts`, 런타임 검증은 `api.ts`에 있습니다.

모든 호출은 Java 게이트웨이의 같은 출처 `/api`로 전달합니다. GET 성공은 JSON 200, 취소 성공은 204 또는 JSON 2xx, 오류는 HTTP 오류 상태와 `{ "error": "설명" }`을 기대합니다. 이름·사본 권한 확인 및 이미지 접근 제어는 서버 책임입니다.

| 메서드 | 경로                                | 응답 / 동작                                                   |
| ------ | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/analyses/{analysisId}`        | `AnalysisJob`, 이전 요청이 끝난 뒤 1초 후 폴링                |
| DELETE | `/api/analyses/{analysisId}`        | 작업 취소 요청. 서버가 취소를 승인한 성공 응답 후 업로드 이동 |
| GET    | `/api/analyses/{analysisId}/result` | `AnalysisResult`                                              |
| GET    | `/api/copies/{copyCode}/path`       | `CopyPath`, 모달을 열 때 조회                                 |

분석 생성·업로드 API는 페이지 1–3의 담당 범위입니다. 응답 ID는 요청 ID와 일치해야 합니다. 화면 이탈 시 요청을 중단하고 늦게 도착한 응답을 무시합니다.

## 공통 파일

```json
{
  "id": "FILE-1",
  "name": "plan.png",
  "sizeBytes": 123456,
  "width": 1920,
  "height": 1080,
  "mimeType": "image/png",
  "imageUrl": "/api/images/FILE-1"
}
```

`imageUrl`은 선택 사항입니다. 미리보기는 동일 출처 절대 경로, HTTPS 또는 로컬 HTTP 주소만 허용합니다. 없거나 로딩에 실패하면 대체 문구를 보여줍니다.

## AnalysisJob

```json
{
  "id": "ANALYSIS-1",
  "status": "running",
  "phase": "watermark",
  "progress": 68,
  "elapsedSeconds": 3,
  "phaseElapsedSeconds": 2,
  "message": "워터마크 패턴 검출 중",
  "file": {
    "id": "FILE-1",
    "name": "plan.png",
    "sizeBytes": 123456,
    "width": 1920,
    "height": 1080,
    "mimeType": "image/png"
  }
}
```

- status: `queued | running | completed | failed | cancelled`
- phase: `validation | watermark | lineage`
- progress: 전체 진행률 0–100 또는 `null`. 단계별 진행률이 아닙니다.
- elapsedSeconds: 서버가 계산한 비음수 초 또는 `null`
- phaseElapsedSeconds: 선택 사항, 단계 경과 초 또는 `null`
- error: 선택 사항. failed의 사용자용 오류 설명

## AnalysisResult

```json
{
  "analysisId": "ANALYSIS-1",
  "status": "identified",
  "file": {
    "id": "FILE-1",
    "name": "plan.png",
    "sizeBytes": 123456,
    "width": 1920,
    "height": 1080,
    "mimeType": "image/png"
  },
  "copyCode": "COPY-C203",
  "document": {
    "code": "DOC-A001",
    "title": "설계도",
    "imageUrl": "/api/images/original-1"
  },
  "score": {
    "value": 0.652,
    "kind": "correlation",
    "calibrated": false,
    "threshold": 0.12
  },
  "analyzedAt": "2026-10-31T01:00:00Z",
  "method": "주파수 영역 검출",
  "distributionSteps": 3,
  "summary": ["서버가 제공한 분석 요약"]
}
```

- status: `identified | not_detected | unlinked | failed`. identified는 copyCode와 document 필수
- copyCode/document/score/analyzedAt/method/distributionSteps: 값이 없으면 명시적으로 `null`
- score.kind: `correlation | zscore | probability`; threshold 선택 사항
- analyzedAt: 시간대가 포함된 ISO 날짜 권장. 화면은 KST로 표시
- distributionSteps: 원본을 포함한 등록 노드 수. 실제 외부 전달 횟수를 의미하지 않음
- summary: 문자열 배열; error: 선택 오류 설명

## CopyPath

```json
{
  "identifiedCopyCode": "COPY-C203",
  "documentCode": "DOC-A001",
  "complete": true,
  "unverifiedSegments": [],
  "nodes": [
    {
      "copyCode": "DOC-A001",
      "parentCopyCode": null,
      "name": "설계도",
      "kind": "document"
    },
    {
      "copyCode": "COPY-B101",
      "parentCopyCode": "DOC-A001",
      "name": "직원 B",
      "kind": "employee"
    },
    {
      "copyCode": "COPY-C203",
      "parentCopyCode": "COPY-B101",
      "name": "협력사 C",
      "kind": "partner"
    }
  ]
}
```

nodes.kind: `document | employee | partner | other`. 각 copyCode는 유일해야 합니다. 순서는 무관합니다. 부모가 없는 시작 노드는 documentCode와 일치하는 document여야 완전한 경로로 표시됩니다. `complete=false` 또는 unverifiedSegments에 설명이 있으면 미확인 경로입니다. 중간 누락은 연결된 끝 구간만 표시하고, 순환·중복·식별 사본 부재는 계보를 그리지 않습니다. 빈 nodes는 빈 상태로 표시합니다. 타임스탬프는 계약에 없습니다.
