import { useEffect, useState } from "react";
import { api, ApiError, type DocRow, type Tree } from "../api";
import { Notice } from "../components/Ui";
import { TreeView } from "./Investigate";

export default function PathTrace() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [selected, setSelected] = useState("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.docs().then((d) => { setDocs(d); if (d[0]) setSelected(d[0].doc_id); }).catch((e: ApiError) => setError(e.message));
  }, []);
  useEffect(() => {
    if (selected) api.tree(selected).then(setTree).catch((e: ApiError) => setError(e.message));
  }, [selected]);

  return (
    <>
      <div className="page-head"><div><h1>경로 추적</h1><p>서버 로그로 본 문서별 사본 트리입니다. 한 사본을 두 사람이 열면 가지가 갈라집니다.</p></div></div>
      {error && <Notice tone="error" title="불러오지 못했습니다">{error}</Notice>}
      <section className="card">
        {docs?.length === 0 && <div className="empty"><p>아직 등록된 문서가 없습니다.</p><a className="btn btn-primary" href="#/docs">문서 등록하기</a></div>}
        {docs && docs.length > 0 && (
          <>
            <label className="field">
              <span>문서</span>
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {docs.map((d) => <option key={d.doc_id} value={d.doc_id}>{d.title} ({d.doc_id})</option>)}
              </select>
            </label>
            {tree && tree.branch_points > 0 && <Notice tone="warn" title={`갈라진 지점 ${tree.branch_points}곳`}>같은 사본이 여러 사람에게 넘어갔습니다.</Notice>}
            {tree && tree.rows === 0 && <div className="empty"><p>서버 로그가 없습니다. 발견된 파일이 있다면 유출 조사에서 장부로 복원하세요.</p></div>}
            {tree && tree.rows > 0 && <TreeView nodes={tree.roots} />}
          </>
        )}
      </section>
    </>
  );
}
