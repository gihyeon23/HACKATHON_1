import { useEffect, useState } from "react";
import { api, ApiError, saveBlob, type TraceResult, type TreeNode } from "../api";
import type { Investigation } from "../App";
import PathGraph from "../components/PathGraph";
import { DropZone, Icon, Notice } from "../components/Ui";

type Tab = "path" | "ledger" | "log";

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <li key={n.hash}>
          <div className={`tree-row ${n.in_file ? "tree-file" : ""}`}>
            <b>{n.actor.name}</b>
            <span className="muted">{n.actor.org}</span>
            <span className="mono">{n.at_kst}</span>
            {n.in_file && <span className="pill">이 파일의 경로</span>}
          </div>
          {n.children.length > 1 && <p className="tree-branch">이 사본에서 가지가 {n.children.length}개로 갈라졌습니다</p>}
          {n.children.length > 0 && <TreeView nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}

function pathNames(r: TraceResult) {
  return r.path.map((p) => p.actor.name).join(" → ");
}

function Compare({ result }: { result: TraceResult }) {
  const log = result.server_log;
  const logNames = log.tree.rows > 0
    ? (function walk(ns: TreeNode[]): string[] { return ns.length ? [ns[0].actor.name, ...walk(ns[0].children)] : []; })(log.tree.roots).join(" → ")
    : "";
  return (
    <div className="compare">
      <div className={`compare-card ${log.state === "empty" ? "compare-bad" : ""}`}>
        <span>기존 방식 · 서버 로그 추적</span>
        <strong>{log.state === "empty" ? "기록 없음 ❓" : logNames}</strong>
        <p>{log.state === "empty" ? "로그가 지워져 서버만으로는 경로를 알 수 없습니다." : `서버 로그 ${log.rows}건을 찾았습니다.`}</p>
      </div>
      <div className={`compare-card ${result.integrity.ok ? "compare-good" : "compare-warn"}`}>
        <span>TraceGuard · 파일 장부 추적</span>
        <strong>{result.path.length ? pathNames(result) : "신뢰할 기록 없음"}{result.integrity.ok ? " ✅" : " ⚠️"}</strong>
        <p>{result.integrity.ok ? "파일 한 장에 경로와 시각이 서명과 함께 남아 있습니다." : "깨진 지점 앞까지만 신뢰합니다."}</p>
      </div>
    </div>
  );
}

function ResultView({ current, onFile, onClear }: {
  current: Investigation; onFile: (f: Blob, n: string, t?: boolean) => Promise<void>; onClear: () => void;
}) {
  const { result, name, tampered, file } = current;
  const [tab, setTab] = useState<Tab>("path");
  const [wiped, setWiped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.overview().then((o) => setWiped(o.logs_wiped)).catch(() => undefined); }, [result]);

  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await job(); } catch (e) { setError(e instanceof ApiError ? e.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  };
  const toggleLogs = () => run(async () => {
    await (wiped ? api.restoreLogs() : api.wipeLogs());
    await onFile(file, name, tampered);
  });
  const tamper = () => run(async () => {
    const bad = await api.tamper(file);
    saveBlob(bad, "조작된_장부.hck");
    await onFile(bad, "조작된_장부.hck", true);
  });

  const ok = result.integrity.ok;
  const log = result.server_log;

  return (
    <>
      <div className="page-head">
        <div><p className="crumb">유출 조사 › {name}</p><h1>유출 조사</h1></div>
        <div className="head-actions">
          <button className="btn btn-danger-ghost" disabled={busy} onClick={toggleLogs}>
            {wiped ? "데모: 서버 로그 복구" : "데모: 서버 로그 지우기"}
          </button>
          {!tampered && <button className="btn btn-danger-ghost" disabled={busy || !result.first_external} onClick={tamper}>데모: 파일 장부 조작</button>}
          <button className="btn btn-ghost" onClick={onClear}>새 파일 분석</button>
        </div>
      </div>

      {error && <Notice tone="error" title="처리하지 못했습니다">{error}</Notice>}

      <section className="card">
        <div className={`result-head ${ok ? "" : "result-bad"}`}>
          <span className="result-mark"><Icon name={ok ? "check" : "alert"} size={26} /></span>
          <div>
            <h2>{ok ? "분석이 완료되었습니다." : "장부 조작이 감지되었습니다."}</h2>
            <p>{ok ? "발견된 파일의 장부로 배포 경로를 복원했습니다." : `연결 끊김(삭제 의심) · ${result.trusted_lines}번째 기록까지만 신뢰합니다.`}</p>
          </div>
        </div>
        <dl className="doc-card">
          <span className="doc-thumb"><Icon name="lock" size={28} /></span>
          <div className="doc-name"><b>{result.title}</b><small>{name}</small></div>
          <div><dt>문서 ID</dt><dd className="mono">{result.doc_id}</dd></div>
          <div><dt>등록일</dt><dd className="mono">{result.path[0]?.at_kst ?? "확인 불가"}</dd></div>
          <div><dt>장부 서명 검증</dt><dd>{ok ? "✅ 전체 정상" : `⚠️ ${result.trusted_lines} / ${result.ledger_lines}줄만 정상`}</dd></div>
        </dl>
      </section>

      {!ok && (
        <Notice tone="error" title="연결 끊김(삭제 의심)">
          {result.integrity.reasons.join(" · ")}
          {log.after_file.length > 0 && <> · 서버 로그에는 이후 기록이 있습니다: <b>{log.after_file.map((e) => e.actor.name).join(", ")}</b></>}
        </Notice>
      )}
      {ok && result.first_external && (
        <Notice tone="error" title={`최초 외부 유출: ${result.first_external.from} → ${result.first_external.to}`}>
          장부상 {result.first_external.at_kst} KST 에 회사 밖에서 처음 열렸고, 직전 열람자는 {result.first_external.from} 입니다.
        </Notice>
      )}
      {ok && result.first_external?.branched && (
        <Notice tone="warn" title="직전 사본이 여러 갈래로 갈라졌습니다">
          {result.first_external.from} 님의 사본을 다른 사람도 열었습니다. 누가 밖으로 넘겼는지는 서버 로그 대조 탭에서 함께 확인하세요.
        </Notice>
      )}
      {ok && log.after_file.length > 0 && (
        <Notice tone="warn" title={`이 사본 이후 서버 기록이 ${log.after_file.length}건 더 있습니다`}>
          이전 사본이거나 장부 끝줄이 잘린 파일일 수 있습니다: {log.after_file.map((e) => e.actor.name).join(", ")}
        </Notice>
      )}
      {!result.registered && <Notice tone="warn" title="서버에 등록되지 않은 문서입니다">키가 없어 열 수 없는 문서입니다.</Notice>}

      <section className="card">
        <div className="tabs" role="tablist">
          {([["path", "배포 경로"], ["ledger", "장부 상세"], ["log", "서버 로그 대조"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab-on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "path" && (result.path.length > 0
          ? <PathGraph result={result} />
          : <div className="empty"><p>신뢰할 수 있는 기록이 없습니다.</p></div>)}

        {tab === "ledger" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>사람</th><th>소속</th><th>기기</th><th>시각 (KST)</th><th>서명</th><th>서버 로그</th></tr></thead>
              <tbody>
                {result.path.map((p, i) => (
                  <tr key={p.hash}>
                    <td>{i + 1}</td><td><b>{p.actor.name}</b></td>
                    <td>{p.external ? <span className="pill pill-danger">외부</span> : p.actor.org}</td>
                    <td>{p.actor.device ?? "미상"}</td>
                    <td className="mono">{p.at_kst}</td>
                    <td>✅ 정상</td>
                    <td>{p.log_match ? "일치" : log.state === "empty" ? "없음" : "⚠️ 불일치"}</td>
                  </tr>
                ))}
                {result.untrusted.map((e) => (
                  <tr key={e.hash} className="row-bad">
                    <td>–</td><td>{e.actor.name}</td><td colSpan={2}>신뢰할 수 없는 줄</td>
                    <td className="mono">{e.at_kst}</td><td>❌</td><td>–</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "log" && (log.tree.rows > 0
          ? <>
              {log.tree.branch_points > 0 && <Notice tone="warn" title="사본이 갈라진 지점이 있습니다">같은 사본을 여러 사람이 열었습니다.</Notice>}
              <TreeView nodes={log.tree.roots} />
            </>
          : <div className="empty"><p>서버 로그가 비어 있습니다. 파일 장부만으로 위 경로를 복원했습니다.</p></div>)}
      </section>

      <Compare result={result} />
    </>
  );
}

export default function Investigate({ current, error, onFile, onClear }: {
  current: Investigation | null; error: string; onFile: (f: Blob, n: string, t?: boolean) => Promise<void>; onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (current) return <ResultView current={current} onFile={onFile} onClear={onClear} />;

  const pick = async (f: File) => {
    setBusy(true);
    await onFile(f, f.name);
    setBusy(false);
  };

  return (
    <>
      <div className="page-head"><div><h1>유출 조사</h1><p>밖에서 발견된 .hck 파일 하나로 경로와 시각을 복원합니다.</p></div></div>
      <section className="hero hero-small">
        <DropZone accept=".hck" title="유출 문서 분석 시작" hint=".hck 파일을 올려 배포 경로를 확인하세요." busy={busy} onFile={pick} />
        <ul className="hero-points">
          <li><Icon name="check" size={16} /> .hck 보호 파일 지원</li>
          <li><Icon name="check" size={16} /> 장부 서명 자동 검증</li>
          <li><Icon name="check" size={16} /> 배포 경로 시각화</li>
        </ul>
      </section>
      {error && <Notice tone="error" title="분석하지 못했습니다">{error}</Notice>}
    </>
  );
}
