import { useEffect, useRef, useState } from "react";
import { api, ApiError, type OpenResult } from "../api";
import { ACCOUNTS } from "../App";
import { Icon, Logo, Notice, SampleTag } from "../components/Ui";

type Identity =
  | { kind: "internal"; id: string; name: string }
  | { kind: "external"; name: string; phone: string };

const SAMPLES = [
  { name: "이OO", phone: "010-1234-1234" },
  { name: "최OO", phone: "010-5678-5678" },
];

/** 전화번호가 남지 않도록 브라우저 저장소에 넣지 않고, 탭이 살아 있는 동안 메모리에만 둔다. */
let sessionIdentity: Identity | null = null;

/** 사람별로 기기 ID 를 하나씩 둔다. 한 노트북으로 시연해도 사람마다 다른 기기로 기록된다. */
function deviceFor(who: string) {
  const key = `tg-device-${who}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const made = `WEB-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    sessionStorage.setItem(key, made);
    return made;
  } catch {
    return "WEB-UNKNOWN";
  }
}

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function ProtectedImage({ b64, mime }: { b64: string; mime: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let closed = false;
    createImageBitmap(new Blob([decode(b64)], { type: mime })).then((bmp) => {
      const c = canvas.current;
      if (closed || !c) return;
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext("2d")?.drawImage(bmp, 0, 0);
    });
    return () => { closed = true; };
  }, [b64, mime]);
  return <canvas ref={canvas} className="protected" aria-label="보호 문서 내용" onContextMenu={(e) => e.preventDefault()} />;
}

function IdentityPicker({ onPick }: { onPick: (i: Identity) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10;
  return (
    <div className="identity">
      <h2>누가 열람하나요?</h2>
      <p className="muted">사내 직원은 계정을 고르고, 외부인은 이름과 전화번호를 입력합니다.</p>
      <div className="identity-accounts">
        {ACCOUNTS.filter((a) => a.id !== "S").map((a) => (
          <button key={a.id} className="btn btn-ghost" onClick={() => onPick({ kind: "internal", id: a.id, name: a.name })}>
            <i className={`avatar avatar-${a.id}`}>{a.id}</i> {a.name} · {a.org}
          </button>
        ))}
      </div>
      <form className="identity-form" onSubmit={(e) => { e.preventDefault(); if (valid) onPick({ kind: "external", name: name.trim(), phone }); }}>
        <label className="field"><span>이름</span><input value={name} maxLength={20} autoComplete="off" onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>전화번호</span><input value={phone} inputMode="tel" placeholder="010-1234-5678" autoComplete="off" onChange={(e) => setPhone(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={!valid}>외부인으로 계속</button>
      </form>
      <div className="identity-samples">
        <SampleTag />
        {SAMPLES.map((s) => (
          <button key={s.name} type="button" className="link" onClick={() => { setName(s.name); setPhone(s.phone); }}>{s.name}</button>
        ))}
      </div>
    </div>
  );
}

export default function Viewer() {
  const [identity, setIdentity] = useState<Identity | null>(sessionIdentity);
  const [opened, setOpened] = useState<OpenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const supported = "showOpenFilePicker" in window;

  const choose = (i: Identity | null) => { sessionIdentity = i; setIdentity(i); setOpened(null); setError(""); };

  const openFile = async () => {
    if (!identity) return;
    setError(""); setBusy(true);
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "TraceGuard 보호 파일", accept: { "application/x-hck": [".hck"] } }],
      });
      // 기록을 파일에 남길 수 있을 때만 서버에 열람을 요청한다
      const granted = await handle.requestPermission({ mode: "readwrite" });
      if (granted !== "granted") throw new ApiError(0, "파일에 열람 기록을 저장하도록 허용해야 문서를 볼 수 있습니다.");

      const who = identity.kind === "internal" ? identity.id : identity.name;
      const result = await api.open(await handle.getFile(), { ...identity, device: deviceFor(who) });

      const writer = await handle.createWritable();
      await writer.write(decode(result.hck_b64));
      await writer.close();
      setOpened(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setOpened(null);
      setError(e instanceof Error ? e.message : "파일을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="viewer">
      <header className="viewer-bar">
        <Logo light />
        <span>보호 파일 뷰어</span>
        {identity && (
          <div className="viewer-who">
            {identity.name}
            <button className="link link-light" onClick={() => choose(null)}>다른 사람으로 열기</button>
          </div>
        )}
      </header>

      <main className="viewer-main">
        {!supported && <Notice tone="error" title="크롬에서 열어 주세요">이 뷰어는 파일에 열람 기록을 저장해야 해서 크롬·엣지에서만 동작합니다.</Notice>}
        {!identity && supported && <section className="card"><IdentityPicker onPick={choose} /></section>}

        {identity && !opened && supported && (
          <section className="card viewer-open">
            <span className="viewer-lock"><Icon name="lock" size={30} /></span>
            <h2>.hck 파일 열기</h2>
            <p className="muted">열어보는 순간 이 파일의 이동 장부에 {identity.name} 님의 열람이 기록됩니다.<br />크롬이 파일 수정 권한을 물으면 허용해 주세요.</p>
            <button className="btn btn-primary btn-large" disabled={busy} onClick={openFile}>{busy ? "여는 중입니다…" : ".hck 파일 선택"}</button>
          </section>
        )}

        {error && <Notice tone="error" title="이 파일은 열 수 없습니다">{error}</Notice>}

        {opened && (
          <div className="viewer-doc">
            <section className="card viewer-image">
              <h2>{opened.title}</h2>
              <ProtectedImage b64={opened.image_b64} mime={opened.image_mime} />
            </section>
            <aside className="card viewer-side">
              <Notice tone="info" title={`${opened.parent.actor.name}님에게서 받은 파일입니다`}>새 열람 기록을 이 파일에 저장했습니다.</Notice>
              <h3>이동 장부</h3>
              <ol className="timeline">
                {opened.ledger.map((e, i) => (
                  <li key={e.hash} className={i === opened.ledger.length - 1 ? "timeline-me" : ""}>
                    <b>{e.actor.name}{i === opened.ledger.length - 1 ? " (나)" : ""}</b>
                    <span className="muted">{e.actor.org}</span>
                    <span className="mono">{e.at_kst}</span>
                  </li>
                ))}
              </ol>
              <button className="btn btn-ghost" onClick={openFile}>다른 파일 열기</button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
