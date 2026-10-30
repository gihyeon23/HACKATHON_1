import { useCallback, useEffect, useState } from "react";
import { api, ApiError, saveBlob, type DocRow } from "../api";
import { ACCOUNTS } from "../App";
import { DropZone, Icon, Notice, SampleTag } from "../components/Ui";

const SAMPLE_TITLE = "Q4 신제품 설계도";

export default function Documents({ account }: { account: string }) {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ blob: Blob; filename: string } | null>(null);
  const [docs, setDocs] = useState<DocRow[] | null>(null);

  const refresh = useCallback(() => api.docs().then(setDocs).catch(() => setDocs([])), []);
  useEffect(() => { refresh(); }, [refresh]);

  const me = ACCOUNTS.find((a) => a.id === account)!;

  const register = async (image: Blob) => {
    setBusy(true); setError(""); setCreated(null);
    try {
      const clean = title.trim();
      const blob = await api.create(image, clean, { kind: "internal", id: account, device: "WEB-SAMPLE" });
      const filename = `${clean.replace(/[\\/:*?"<>|\s]+/g, "")}.hck`;
      saveBlob(blob, filename);
      setCreated({ blob, filename });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const useSample = async () => {
    try {
      await register(await api.sampleImage());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "샘플을 불러오지 못했습니다.");
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>문서 관리</h1><p>기밀 문서를 .hck 보호 파일로 만듭니다.</p></div>
      </div>

      <section className="card">
        <h2>새 문서 등록</h2>
        <p className="muted">등록자: <b>{me.name}</b> ({me.org})</p>
        <label className="field">
          <span>문서 제목</span>
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <DropZone accept="image/png,image/jpeg" title="이미지를 올려 .hck 만들기" hint="PNG · JPG · 최대 25MB" busy={busy} onFile={register} />
        <button className="btn btn-ghost" disabled={busy || !title.trim()} onClick={useSample}>
          샘플 설계도로 등록 <SampleTag />
        </button>
        {error && <Notice tone="error" title="등록하지 못했습니다">{error}</Notice>}
        {created && (
          <Notice tone="ok" title={`${created.filename} 파일을 받았습니다`}>
            이 파일은 어떤 방법으로 보내도 됩니다. 열어보는 순간 기록됩니다.
            <div className="notice-actions">
              <button className="btn btn-ghost" onClick={() => saveBlob(created.blob, created.filename)}>다시 받기</button>
              <a className="btn btn-primary" href="#/viewer"><Icon name="eye" size={17} /> 뷰어로 이동</a>
            </div>
          </Notice>
        )}
      </section>

      <section className="card">
        <h2>등록된 문서</h2>
        {docs?.length === 0 && <div className="empty"><p>아직 등록된 문서가 없습니다.</p></div>}
        {docs && docs.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>문서</th><th>문서 ID</th><th>등록자</th><th>등록일 (KST)</th><th>열람</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.doc_id}>
                    <td><b>{d.title}</b></td>
                    <td className="mono">{d.doc_id}</td>
                    <td>{d.created_by.name}</td>
                    <td className="mono">{d.created_at_kst}</td>
                    <td>{d.opens}회</td>
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
