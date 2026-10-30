import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, errorMessage, isAbortError } from "../api/client";
import type { HckOpened, RecipientType } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { recipientLabel } from "../lib/format";

const VIEWER_STEPS = ["보호 파일 선택", "열람자 확인", "문서 보기"];
// 이전 서비스명(TraceGuard) 때의 키를 유지한다. 바꾸면 기존 열람자가 새 기기로 인식된다
const IDENTITY_KEY = "traceguard.viewer";

interface Identity {
  name: string;
  recipientType: RecipientType;
  viewerId: string;
}

// 크롬 · 엣지의 File System Access API (연 파일을 그 자리에서 갱신). 다른 브라우저는 새 파일을 내려받는다
interface WritableFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}
type FilePickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<WritableFileHandle[]>;
};

/** 기기 식별값과 마지막 입력 이름. 저장소가 막혀 있어도 화면은 동작해야 한다 */
function loadIdentity(): Identity {
  try {
    const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "null") as Partial<Identity> | null;
    if (saved?.viewerId) {
      return { name: saved.name ?? "", recipientType: saved.recipientType ?? "PARTNER", viewerId: saved.viewerId };
    }
  } catch {
    // 무시하고 새로 만든다
  }
  return { name: "", recipientType: "PARTNER", viewerId: crypto.randomUUID() };
}

function saveIdentity(identity: Identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // 저장하지 못해도 이번 열람은 진행한다
  }
}

function base64ToBlob(base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/x-hck" });
}

async function sameBytes(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const ua = new Uint8Array(x);
  const ub = new Uint8Array(y);
  return ua.every((v, i) => v === ub[i]);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface HckViewerPageProps {
  onHome: () => void;
}

/**
 * 보호 파일(.hck) 뷰어. 파일에는 이미지가 없고, 열 때마다 서버가 장부를 검증한 뒤
 * 열람자 전용 워터마크 사본을 보여준다. 갱신된 장부는 같은 파일에 다시 저장한다.
 */
export function HckViewerPage({ onHome }: HckViewerPageProps) {
  const [identity, setIdentity] = useState<Identity>(loadIdentity);
  const [file, setFile] = useState<{ blob: Blob; name: string; handle?: WritableFileHandle } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<HckOpened | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const canOverwrite = typeof (window as FilePickerWindow).showOpenFilePicker === "function";

  function pick(blob: Blob, name: string, handle?: WritableFileHandle) {
    if (!name.toLowerCase().endsWith(".hck")) {
      setError(".hck 보호 파일만 열 수 있습니다.");
      return;
    }
    setError(null);
    setFile({ blob, name, handle });
  }

  async function choose() {
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      inputRef.current?.click();
      return;
    }
    try {
      const [handle] = await picker({ types: [{ description: "ReTrace 보호 파일", accept: { "application/x-hck": [".hck"] } }] });
      const picked = await handle.getFile();
      pick(picked, picked.name, handle);
    } catch {
      // 선택 창을 닫은 경우
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pick(dropped, dropped.name);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("보호 파일을 선택해주세요.");
      return;
    }
    const name = identity.name.trim();
    if (!name) {
      setError("열람자 이름을 입력해주세요.");
      return;
    }
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setBusy(true);
    setError(null);
    const next = { ...identity, name };
    saveIdentity(next);
    try {
      const result = await api.openHck(file.blob, next, ctrl.signal);
      setImageFailed(false);
      setOpened(result);
      setSaveNote(await saveUpdated(result));
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err));
    } finally {
      if (requestRef.current === ctrl) setBusy(false);
    }
  }

  /** 장부가 바뀌었으면 같은 파일에 덮어쓰고, 안 되면 새 파일로 내려받게 한다 */
  async function saveUpdated(result: HckOpened): Promise<string | null> {
    if (!file) return null;
    const updated = base64ToBlob(result.hckBase64);
    if (await sameBytes(updated, file.blob)) return null;
    if (file.handle) {
      try {
        const writable = await file.handle.createWritable();
        await writable.write(updated);
        await writable.close();
        return `열람 기록을 ${file.name} 에 저장했습니다. 다른 사람에게 전달할 때는 이 파일을 보내세요.`;
      } catch {
        // 덮어쓰기 권한을 거절하면 내려받기로 넘어간다
      }
    }
    downloadBlob(updated, file.name);
    return `열람 기록이 담긴 ${file.name} 을 새로 내려받았습니다. 다른 사람에게 전달할 때는 새 파일을 보내세요.`;
  }

  function reset() {
    setOpened(null);
    setFile(null);
    setSaveNote(null);
    setError(null);
  }

  if (opened) {
    return (
      <AppShell step={3} steps={VIEWER_STEPS} breadcrumb={["보호 파일", opened.title]} onBack={reset}>
        <div className="page-head">
          <p className="eyebrow">PROTECTED DOCUMENT</p>
          <h1>{opened.title}</h1>
          <p>
            {opened.parentName
              ? `${opened.parentName} 님에게서 받은 파일입니다.`
              : "내 사본입니다."}{" "}
            이 화면에는 열람자({opened.name}) 정보가 워터마크로 들어 있습니다.
          </p>
        </div>

        {saveNote && (
          <p className="banner banner-info" role="status">
            <Icon name="info" size={18} />
            {saveNote}
          </p>
        )}

        <section className="card viewer-doc" aria-label="문서 내용">
          {imageFailed ? (
            <p className="viewer-empty">
              <Icon name="alert" size={22} />
              문서 이미지를 불러오지 못했습니다.
            </p>
          ) : (
            <img src={api.copyFileUrl(opened.copyCode)} alt={`${opened.title} (${opened.copyCode})`} onError={() => setImageFailed(true)} />
          )}
        </section>

        <section className="card viewer-ledger" aria-labelledby="viewer-ledger-title">
          <div className="viewer-ledger-head">
            <h2 id="viewer-ledger-title">이 파일의 전달 기록</h2>
            <span className="muted">
              내 사본 {opened.copyCode}
              {opened.reopened ? " · 새 사본 없이 다시 열었습니다" : " · 이번 열람으로 발급"}
            </span>
          </div>
          <ol className="viewer-chain">
            {opened.ledger
              .filter((line) => line.event !== "CLAIM")
              .map((line, i, lines) => (
                <li key={line.seq} className={i === lines.length - 1 ? "is-me" : undefined}>
                  <Icon name={line.recipientType === "EMPLOYEE" ? "user" : "building"} size={18} />
                  <b>{line.name}</b>
                  <span>
                    {line.copyCode} · {line.event === "ISSUE" ? "플랫폼 발급" : "보호 파일로 전달받음"}
                  </span>
                </li>
              ))}
          </ol>
          <p className="summary-disclaimer">
            <Icon name="info" size={16} />
            등록된 열람 기록이며 실제 유출자를 확정하지 않습니다. 배포 시각은 표시하지 않습니다.
          </p>
        </section>

        <div className="center-actions">
          <button type="button" className="btn btn-outline" onClick={onHome}>
            처음으로
          </button>
          <button type="button" className="btn btn-primary" onClick={reset}>
            <Icon name="refresh" size={18} />
            다른 보호 파일 열기
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell step={file ? 2 : 1} steps={VIEWER_STEPS} breadcrumb={["보호 파일", "열기"]} onBack={onHome}>
      <input
        ref={inputRef}
        type="file"
        accept=".hck"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) pick(picked, picked.name);
        }}
      />

      <div className="page-head">
        <p className="eyebrow">PROTECTED DOCUMENT</p>
        <h1>받은 보호 파일을 여세요.</h1>
        <p>보호 파일(.hck)은 이 뷰어에서만 열립니다. 열 때마다 열람자 기록이 파일과 서버에 남습니다.</p>
      </div>

      <form className="card form-card" onSubmit={submit} noValidate>
        {error && (
          <p className="banner banner-error" role="alert">
            <Icon name="alert" size={18} />
            {error}
          </p>
        )}

        <div className="field">
          <span className="field-label">
            보호 파일 <span className="req">*</span>
            <span className="field-hint">.hck</span>
          </span>
          {file ? (
            <div className="picked">
              <div className="picked-thumb">
                <Icon name="lock" size={32} />
              </div>
              <div className="picked-body">
                <div className="file-confirm-title">
                  <h2>{file.name}</h2>
                </div>
                <p className="file-confirm-sub">
                  {file.handle ? "열면 이 파일에 열람 기록을 바로 저장합니다." : "열면 열람 기록이 담긴 새 파일을 내려받습니다."}
                </p>
              </div>
              <button type="button" className="icon-btn picked-close" aria-label="선택한 파일 지우기" onClick={() => setFile(null)} disabled={busy}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ) : (
            <div
              className={`dropzone dropzone-sm${dragOver ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Icon name="lock" size={48} strokeWidth={1.4} className="dropzone-icon" />
              <p className="dropzone-title">카톡 · 이메일로 받은 .hck 파일을 끌어다 놓으세요.</p>
              <button type="button" className="btn btn-primary btn-pick" onClick={choose}>
                <Icon name="file" size={18} />
                보호 파일 선택
              </button>
              {!canOverwrite && <p className="field-help center">크롬 · 엣지에서는 연 파일에 기록이 바로 저장됩니다.</p>}
            </div>
          )}
        </div>

        <label className="field">
          <span className="field-label">
            열람자 이름 <span className="req">*</span>
            <span className="field-hint">이 이름이 문서에 워터마크로 들어갑니다</span>
          </span>
          <input
            className="text-input"
            value={identity.name}
            onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
            placeholder="예: 협력사 C"
            maxLength={50}
          />
        </label>

        <fieldset className="field">
          <legend className="field-label">열람자 유형</legend>
          <div className="segmented" role="radiogroup">
            {(["EMPLOYEE", "PARTNER"] as const).map((t) => (
              <label key={t} className={`segmented-item${identity.recipientType === t ? " is-on" : ""}`}>
                <input type="radio" name="recipientType" value={t} checked={identity.recipientType === t} onChange={() => setIdentity({ ...identity, recipientType: t })} />
                <Icon name={t === "EMPLOYEE" ? "user" : "building"} size={20} />
                {recipientLabel(t)}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner spinner-sm" aria-hidden="true" />
              열람자 사본을 준비하는 중…
            </>
          ) : (
            <>
              <Icon name="lock" size={18} />
              보호 파일 열기
            </>
          )}
        </button>
        <p className="field-help center">처음 여는 기기는 열람자 전용 워터마크를 넣느라 몇 초 걸립니다. 신원은 입력값을 그대로 씁니다 (본인 인증 없음).</p>
      </form>
    </AppShell>
  );
}
