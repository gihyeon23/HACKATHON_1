import { useEffect, useMemo, useState } from "react";
import { AnalysisProgressPage } from "./features/investigation/AnalysisProgressPage";
import { AnalysisResultPage } from "./features/investigation/AnalysisResultPage";
import { createInvestigationApi } from "./features/investigation/api";
import { createMockApi } from "./features/investigation/mockApi";
import { demoFile, type DemoScenario } from "./features/investigation/fixtures";

type View = "progress" | "result" | "handoff";
const readView = (): View =>
  location.hash.includes("result")
    ? "result"
    : location.hash.includes("progress")
      ? "progress"
      : "handoff";

/** Development handoff only: pages 1–3 stay owned by their existing assignee. */
export default function App() {
  const [view, setView] = useState<View>(readView);
  const [length, setLength] = useState(3);
  const [scenario, setScenario] = useState<DemoScenario>("identified");
  const [session, setSession] = useState(0);
  const mock = import.meta.env.VITE_USE_MOCK !== "false";
  const analysisId =
    new URLSearchParams(location.search).get("analysisId") || "DEMO-ANALYSIS";
  const api = useMemo(
    () => (mock ? createMockApi(length, scenario) : createInvestigationApi()),
    [mock, length, scenario, session],
  );
  const go = (next: View) => {
    setView(next);
    location.hash = next === "handoff" ? "/handoff" : `/${next}`;
  };
  useEffect(() => {
    const change = () => setView(readView());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return (
    <>
      <div className="development-bar">
        <span>
          <strong>TraceGuard</strong> · Page 4 / 5 / 6 개발용 연결 화면
        </span>
        <div>
          {mock ? (
            <>
              <label>
                경로 길이
                <select
                  value={length}
                  onChange={(event) => setLength(Number(event.target.value))}
                >
                  {[3, 5, 7].map((value) => (
                    <option key={value} value={value}>
                      {value}단계
                    </option>
                  ))}
                </select>
              </label>
              <label>
                검증 상태
                <select
                  value={scenario}
                  onChange={(event) =>
                    setScenario(event.target.value as DemoScenario)
                  }
                >
                  <option value="identified">식별 성공</option>
                  <option value="not_detected">미검출</option>
                  <option value="unlinked">기록 미연결</option>
                  <option value="failed">분석 실패</option>
                  <option value="missing_parent">부모 기록 누락</option>
                  <option value="cycle">순환 관계</option>
                  <option value="empty_path">빈 경로</option>
                  <option value="path_error">경로 조회 오류</option>
                </select>
              </label>
            </>
          ) : (
            <span>API 모드 · analysisId: {analysisId}</span>
          )}
          <button
            type="button"
            onClick={() => {
              setSession((value) => value + 1);
              go("progress");
            }}
          >
            4. 분석 진행
          </button>
          <button type="button" onClick={() => go("result")}>
            5. 결과 확인
          </button>
        </div>
      </div>
      {view === "progress" ? (
        <AnalysisProgressPage
          key={`${session}-${length}-${scenario}`}
          api={api}
          analysisId={analysisId}
          file={mock ? demoFile : undefined}
          onCompleted={() => go("result")}
          onCancelled={() => go("handoff")}
        />
      ) : view === "result" ? (
        <AnalysisResultPage
          api={api}
          analysisId={analysisId}
          onUpload={() => go("handoff")}
        />
      ) : (
        <main className="handoff">
          <div className="handoff-logo">TraceGuard</div>
          <span className="mock-tag">페이지 1–3 연결 지점</span>
          <h1>분석 진행·결과·배포 경로 미리보기</h1>
          <p>
            업로드 담당 화면에서 발급된 analysisId와 파일 정보를 Page 4
            컴포넌트에 전달하면 됩니다.
            <br />이 화면은 담당 범위 4·5·6을 확인하기 위한 개발용 진입점입니다.
          </p>
          {mock ? (
            <p className="handoff-note">
              샘플 데이터이며 실제 파일 분석을 실행하지 않습니다.
            </p>
          ) : (
            <p className="handoff-note">
              실제 API 계약은 frontend/README.md에서 확인할 수 있습니다.
            </p>
          )}
          <div>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setSession((value) => value + 1);
                go("progress");
              }}
            >
              분석 진행부터 확인하기
            </button>
            <button
              className="button outline"
              type="button"
              onClick={() => go("result")}
            >
              결과 화면 바로 보기
            </button>
          </div>
        </main>
      )}
    </>
  );
}
