import type { Investigation } from "../App";

export default function Report({ current }: { current: Investigation | null }) {
  if (!current) {
    return (
      <>
        <div className="page-head"><div><h1>보고서</h1><p>유출 조사 결과를 한 장으로 정리합니다.</p></div></div>
        <section className="card"><div className="empty">
          <p>아직 조사한 파일이 없습니다.</p>
          <a className="btn btn-primary" href="#/investigate">유출 조사 시작</a>
        </div></section>
      </>
    );
  }
  const { result, name } = current;
  const logState = { match: "파일 장부와 일치", mismatch: "파일 장부와 불일치", empty: "로그 없음" }[result.server_log.state];

  return (
    <>
      <div className="page-head no-print">
        <div><h1>보고서</h1><p>샘플 데이터 기준 조사 결과입니다.</p></div>
        <div className="head-actions"><button className="btn btn-primary" onClick={() => window.print()}>인쇄 · PDF 저장</button></div>
      </div>
      <article className="card report">
        <h2>유출 조사 보고서 · {result.title}</h2>
        <p className="muted">문서 ID {result.doc_id} · 분석 파일 {name} · 샘플 데이터</p>
        <h3>결론</h3>
        <p>
          {result.first_external
            ? `장부상 최초 외부 유출은 ${result.first_external.from} → ${result.first_external.to} 구간이며, ${result.first_external.at_kst} KST 에 외부에서 처음 열렸습니다.${result.first_external.branched ? " 직전 사본이 여러 갈래로 갈라져 있어 서버 로그 대조가 필요합니다." : ""}`
            : "이 파일의 신뢰 구간에서는 외부 유출 지점이 확인되지 않았습니다."}
          {result.last_holder && ` 장부상 마지막 소지자는 ${result.last_holder.name} 입니다.`}
        </p>
        <h3>경로</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>사람</th><th>소속</th><th>기기</th><th>시각 (KST)</th><th>서명</th></tr></thead>
            <tbody>
              {result.path.map((p, i) => (
                <tr key={p.hash}><td>{i + 1}</td><td>{p.actor.name}</td><td>{p.actor.org}</td><td>{p.actor.device ?? "미상"}</td><td className="mono">{p.at_kst}</td><td>✅ 정상</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>무결성</h3>
        <p>
          장부 {result.ledger_lines}줄 중 {result.trusted_lines}줄 신뢰. 서버 로그: {logState}.
          {!result.integrity.ok && ` 이상: ${result.integrity.reasons.join(", ")}.`}
        </p>
        <h3>한계</h3>
        <ul>
          <li>화면 캡처·촬영으로 그림이 된 뒤의 경로는 이번 범위 밖입니다.</li>
          <li>이전 사본은 그때까지의 경로만 담고 있습니다. 서버 로그가 없으면 끝줄이 잘린 파일과 구분할 수 없습니다.</li>
          <li>파일을 열지 않고 그대로 넘긴 사람은 장부에 남지 않습니다. 장부의 직전 열람자를 곧바로 유출자로 단정할 수 없습니다.</li>
          <li>사내 계정과 외부인 신원은 본인 입력값이며 본인 인증을 거치지 않습니다.</li>
          <li>파일 장부 기록은 정상 뷰어로 열 때 저장됩니다. 뷰어를 거치지 않은 열람은 서버 로그에만 남습니다.</li>
        </ul>
      </article>
    </>
  );
}
