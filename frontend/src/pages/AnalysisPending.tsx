import { FlowHeader, FlowPage, Stepper } from "../components/Flow";

/** 분석 진행 화면(#19)이 들어올 자리. 분석은 서버에서 이미 시작된 상태다 */
export default function AnalysisPending({ analysisId }: { analysisId: string }) {
  return (
    <FlowPage>
      <FlowHeader crumbs={["새 조사 시작"]} />
      <Stepper step={1} />
      <div className="flow-title">
        <h1>분석을 시작했습니다.</h1>
        <p>분석 진행 화면은 준비 중입니다. (분석 ID {analysisId})</p>
      </div>
    </FlowPage>
  );
}
