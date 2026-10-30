import { useEffect, useState } from "react";
import { api, ApiError, type Overview } from "../api";
import { Notice } from "../components/Ui";

export default function Settings() {
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = () => api.overview().then(setData).catch((e: ApiError) => setError(e.message));
  useEffect(() => { load(); }, []);

  const act = async (job: () => Promise<unknown>, done: string) => {
    setError(""); setMessage("");
    try { await job(); setMessage(done); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : "실패했습니다."); }
  };

  return (
    <>
      <div className="page-head"><div><h1>설정</h1><p>시연 상태를 관리합니다.</p></div></div>
      {error && <Notice tone="error" title="처리하지 못했습니다">{error}</Notice>}
      {message && <Notice tone="ok" title={message} />}
      <section className="card">
        <h2>데모 제어</h2>
        {data && !data.demo_mode && <p className="muted">데모 모드가 꺼져 있습니다.</p>}
        <div className="setting-row">
          <div><b>서버 로그</b><p className="muted">{data?.logs_wiped ? "지워진 상태" : `${data?.log_rows ?? "–"}건 보관 중`}</p></div>
          <button className="btn btn-ghost" disabled={!data?.demo_mode} onClick={() => act(data?.logs_wiped ? api.restoreLogs : api.wipeLogs, data?.logs_wiped ? "서버 로그를 복구했습니다." : "서버 로그를 지웠습니다.")}>
            {data?.logs_wiped ? "로그 복구" : "로그 지우기"}
          </button>
        </div>
        <div className="setting-row">
          <div><b>데모 초기화</b><p className="muted">등록 문서·키·로그를 모두 지웁니다. 이미 만든 .hck 파일은 더 열리지 않습니다.</p></div>
          {confirming
            ? <div className="head-actions">
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>취소</button>
                <button className="btn btn-danger" onClick={() => { setConfirming(false); act(api.reset, "초기화했습니다."); }}>모두 지우기</button>
              </div>
            : <button className="btn btn-danger-ghost" disabled={!data?.demo_mode} onClick={() => setConfirming(true)}>초기화</button>}
        </div>
      </section>
    </>
  );
}
