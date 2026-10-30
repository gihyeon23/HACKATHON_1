# TraceGuard frontend — Page 4 / 5 / 6

ZIP·Figma 화면 번호 기준으로 구현한 React + TypeScript + Vite 앱입니다.

| 이슈                                                      | 구현                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| [#19](https://github.com/gihyeon23/HACKATHON_1/issues/19) | 4. 분석 진행: 단계별 상태, 서버 진행률, 취소, 오류·재조회     |
| [#20](https://github.com/gihyeon23/HACKATHON_1/issues/20) | 5. 결과 확인: 이미지, 사본·문서 ID, 점수, 요약, 원본 보기     |
| [#21](https://github.com/gihyeon23/HACKATHON_1/issues/21) | 6. 배포 경로: 결과 위 모달, 동적 세로 계보, 누락·순환·빈 경로 |

작업 브랜치: `feat/traceguard-flow`, 기준 브랜치: `develop`. 페이지 1–3, 백엔드, 워터마크 엔진은 변경하지 않습니다.

## 실행

Node.js 22.12 이상(또는 20.19 이상)이 필요합니다. 저장소 루트에서:

```sh
cd frontend
npm ci
npm run dev
```

브라우저에서 <http://127.0.0.1:5174>를 엽니다. 개발용 진입점에서 분석 진행 또는 결과 화면으로 이동합니다. 상단에서 경로 길이 3/5/7단계와 성공·미검출·미연결·실패·누락·순환·빈 경로·조회 오류를 선택할 수 있습니다. 모달은 ESC, X, 바깥 영역 클릭으로 닫힙니다.

```sh
npm test
npm run build
npm run preview
```

테스트는 부모 ID 기반 경로 복원, 누락·순환·중복 검증, 응답 계약, 취소/언마운트 이후 지연 응답 무시, 모달 포커스 복귀, 3/5/7단계 표시 등을 검증합니다.

## 샘플 모드와 실제 API

**기본값은 DEMO입니다. 실제 이미지 분석을 실행하지 않습니다.** 이름·파일 크기·해상도·점수·시각·경로는 UI 확인용 예시입니다. 미리보기는 저장소의 `tracing/server/demo/sample_blueprint.png`를 복사한 샘플 이미지입니다.

`.env.example`을 `.env.local`로 복사하고 `VITE_USE_MOCK=false`로 바꾸면 Java 게이트웨이용 클라이언트를 사용합니다. 개발 서버를 다시 시작한 뒤 `http://127.0.0.1:5174/?analysisId=<서버에서 발급한 ID>#/progress`로 접근합니다. `/api`는 기본적으로 `http://localhost:8080`으로 프록시합니다. Python 엔진을 직접 호출하지 않습니다.

**develop에는 실제 analyses/copies API와 [공식 명세](../docs/API_SPEC.md)가 추가되어 있습니다.** 현재 UI의 클라이언트는 이전 제안 형식을 사용하므로 공식 명세에 맞춘 수정과 실제 서버 통합 검증이 필요합니다. 현 단계에서는 DEMO 모드로 화면을 확인하세요. [기존 제안 계약](docs/API_CONTRACT.md)은 구현 이력을 설명하는 참고 자료이며 백엔드 구현 요청이나 공식 명세가 아닙니다. API 오류를 샘플 성공 결과로 대체하지 않습니다.

## 페이지 1–3 담당자 연결

`App.tsx`는 개발 확인용 진입점입니다. 실제 앱의 업로드 완료 시 다음 컴포넌트를 렌더링합니다. 두 페이지 모두 전역 라우터에 의존하지 않습니다.

```tsx
import { AnalysisProgressPage } from "./features/investigation/AnalysisProgressPage";
import { AnalysisResultPage } from "./features/investigation/AnalysisResultPage";
import { createInvestigationApi } from "./features/investigation/api";

// 컴포넌트 밖 또는 useMemo로 API 객체를 유지합니다.
const api = createInvestigationApi();

// 업로드 서버가 발급한 analysisId, 업로드 파일 메타데이터(file)를 전달
<AnalysisProgressPage
  api={api}
  analysisId={analysisId}
  file={file}
  onCompleted={(id) => navigateToResult(id)}
  onCancelled={navigateToUpload}
/>;

<AnalysisResultPage
  api={api}
  analysisId={analysisId}
  onUpload={navigateToUpload}
/>;
```

실제 라우터의 이동 함수로 콜백을 연결하고 `src/styles.css`, Pretendard 스타일을 앱 진입점에서 가져옵니다. `file`은 선택 사항이며 API 모드에서는 서버가 제공하지 않은 정보를 꾸며 표시하지 않습니다. 진행률은 서버 값만 표시하고 `null`이면 불확정 표시를 사용합니다. DELETE 성공 뒤 업로드로 이동하며, 실패하면 서버 작업이 진행 중일 수 있음을 알립니다.

## 계보와 점수 해석

- 계보는 배열 순서가 아니라 `parentCopyCode`로 복원합니다. 등록되지 않은 연결을 생성하지 않습니다. 누락된 부모 이전 구간은 표시하지 않고 미확인으로 알립니다.
- 마지막 식별 사본만 강조합니다. 노드 클릭이나 임의 시간 정보는 없습니다. 모달 높이를 제한하고 목록만 스크롤하며 배경 스크롤과 키보드 포커스를 잠급니다.
- 상관 점수·z-score를 백분율 확률로 바꾸지 않습니다. `kind=probability`, `calibrated=true`, 0–1 범위일 때만 확률로 표시합니다.
- 패턴 검출만으로 전달 순서나 실제 유출자를 확정할 수 없습니다. 이 화면은 서버에 등록된 부모 관계를 보여줍니다. 외부 메신저 재전송은 워터마크 변경이나 전달 기록을 자동 생성하지 않습니다.
