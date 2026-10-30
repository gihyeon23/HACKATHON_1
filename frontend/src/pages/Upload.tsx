import { useRef, useState } from "react";
import { api, ApiError, formatSize, type UploadedFile } from "../api";
import { FlowHeader, FlowPage, Stepper } from "../components/Flow";
import { Icon, Notice } from "../components/Ui";

const MAX_SIZE = 50 * 1024 * 1024;

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function Features({ wide }: { wide: boolean }) {
  return (
    <div className={`features ${wide ? "features-wide" : ""}`}>
      <div><i><Icon name="lock" size={22} /></i><b>안전한 분석</b><p>업로드한 파일은 암호화되어<br />안전하게 처리됩니다.</p></div>
      <div><i><Icon name="scan" size={22} /></i><b>자동 워터마크 검출</b><p>이미지에서 식별 정보를<br />자동으로 분석합니다.</p></div>
      <div><i><Icon name="share" size={22} /></i><b>배포 경로 추적</b><p>등록된 문서와 사본의<br />전달 경로를 확인합니다.</p></div>
    </div>
  );
}

export default function Upload() {
  const [picked, setPicked] = useState<UploadedFile | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await job(); } catch (e) { setError(message(e, "요청을 처리하지 못했습니다.")); } finally { setBusy(false); }
  };
  const choose = (f: File) => {
    setError("");
    if (!/\.(png|jpe?g)$/i.test(f.name)) return setError("PNG, JPG, JPEG 파일만 지원합니다.");
    if (f.size > MAX_SIZE) return setError("최대 50MB까지 올릴 수 있습니다.");
    run(async () => setPicked(await api.upload(f)));
  };

  return (
    <FlowPage>
      <FlowHeader crumbs={["새 조사 시작"]} />
      <Stepper step={0} />
      <div className="flow-title">
        <p className="eyebrow-blue">DOCUMENT TRACEABILITY</p>
        <h1>유출된 문서를 업로드하세요.</h1>
        <p>이미지에 삽입된 워터마크를 분석하여 사본을 식별하고, 확인된 배포 경로를 추적합니다.</p>
      </div>
      <input ref={input} type="file" accept=".png,.jpg,.jpeg" hidden aria-label="이미지 파일"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(f); e.target.value = ""; }} />

      {!picked && (
        <div className={`dropbox ${over ? "dropbox-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) choose(f); }}>
          <span className="dropbox-cloud"><Icon name="cloud" size={62} /></span>
          <strong>파일을 여기에 끌어다 놓으세요.</strong>
          <p>PNG, JPG, JPEG 파일을 지원합니다. (최대 50MB)</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}><Icon name="doc" size={17} /> {busy ? "업로드 중입니다…" : "파일 선택"}</button>
        </div>
      )}

      {picked && (
        <section className="picked">
          <div className="picked-top">
            <div className="picked-thumb">
              <img src={api.imageUrl(picked.fileId)} alt={`${picked.name} 미리보기`} />
              <a href={api.imageUrl(picked.fileId)} target="_blank" rel="noreferrer" aria-label="크게 보기"><Icon name="search" size={15} /></a>
            </div>
            <div className="picked-info">
              <div className="picked-name">
                <b>{picked.name}</b>
                <em><Icon name="check" size={13} /> 분석 가능</em>
                <button aria-label="선택 취소" disabled={busy} onClick={() => { setPicked(null); setError(""); }}><Icon name="close" size={16} /></button>
              </div>
              <p>{picked.format} <i /> {formatSize(picked.size)} <i /> {picked.width} × {picked.height}</p>
              <dl>
                <div><dt><Icon name="doc" size={18} /> 파일 형식</dt><dd>{picked.format} (이미지 파일)</dd></div>
                <div><dt><Icon name="database" size={18} /> 파일 크기</dt><dd>{formatSize(picked.size)} (최대 50MB 이하)</dd></div>
                <div><dt><Icon name="image" size={18} /> 해상도</dt><dd>{picked.width} × {picked.height}</dd></div>
              </dl>
            </div>
          </div>
          <button className="btn btn-outline btn-wide" disabled={busy} onClick={() => input.current?.click()}><Icon name="refresh" size={18} /> 다른 파일 선택</button>
        </section>
      )}

      {error && <div className="flow-narrow"><Notice tone="error" title="처리하지 못했습니다">{error}</Notice></div>}

      <div className="or"><span>또는</span></div>
      <button className="demo-row" disabled={busy} onClick={() => run(async () => setPicked(await api.uploadDemo()))}>
        <i><Icon name="doc" size={22} /></i>
        <span><b>데모 이미지로 체험하기</b><small>샘플 문서로 분석 결과를 바로 확인해보세요.</small></span>
        <Icon name="right" size={18} />
      </button>
      <Features wide={!!picked} />
    </FlowPage>
  );
}
