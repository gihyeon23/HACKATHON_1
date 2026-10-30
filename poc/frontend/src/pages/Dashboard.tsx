import { useEffect, useState } from "react";
import { api, ApiError, type Overview } from "../api";
import { Icon, Notice } from "../components/Ui";

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.overview().then(setData).catch((e: ApiError) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">DOCUMENT SECURITY &amp; TRACEABILITY</p>
        <h1>문서가 어디서 왔는지,<br />이제 추적할 수 있습니다.</h1>
        <p className="hero-sub">파일을 어떻게 보내든 상관없습니다. 열어보는 순간 기록됩니다.</p>
        <a className="hero-cta" href="#/investigate">
          <span className="drop-icon"><Icon name="upload" size={24} /></span>
          <span className="drop-text"><strong>유출 문서 분석 시작</strong><small>발견된 .hck 파일을 올려 배포 경로를 확인하세요.</small></span>
          <span className="drop-go"><Icon name="arrow" size={20} /></span>
        </a>
      </section>

      {error && <Notice tone="error" title="현황을 불러오지 못했습니다">{error}</Notice>}
      {data?.logs_wiped && <Notice tone="warn" title="서버 로그가 지워진 상태입니다">데모로 지운 상태입니다. 설정에서 복구할 수 있습니다.</Notice>}

      <section className="stats" aria-label="현황">
        <div className="stat"><span>등록 문서</span><b>{data?.documents ?? "–"}</b></div>
        <div className="stat"><span>전체 열람</span><b>{data?.opens ?? "–"}</b></div>
        <div className="stat stat-danger"><span>외부 열람</span><b>{data?.external_opens ?? "–"}</b></div>
        <div className="stat"><span>서버 로그</span><b>{data?.log_rows ?? "–"}</b></div>
      </section>

      <section className="card">
        <h2>최근 기록</h2>
        {data && data.recent.length === 0 && (
          <div className="empty">
            <p>{data.logs_wiped ? "서버 로그가 비어 있습니다." : "아직 기록이 없습니다. 문서를 등록하면 여기에 나타납니다."}</p>
            {!data.logs_wiped && <a className="btn btn-primary" href="#/docs">문서 등록하기</a>}
          </div>
        )}
        {data && data.recent.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>시각 (KST)</th><th>사람</th><th>구분</th><th>문서</th><th>동작</th></tr></thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.at_kst}</td>
                    <td>{r.actor.name}</td>
                    <td>{r.external ? <span className="pill pill-danger">외부</span> : <span className="pill">사내</span>}</td>
                    <td>{r.title ?? "–"}</td>
                    <td>{r.event === "create" ? "등록" : "열람"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
