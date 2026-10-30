import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, errorMessage, isAbortError } from "../api/client";
import type { DocumentCreated } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { formatBytes, formatFromName, formatResolution, validateUpload } from "../lib/format";

export const ISSUE_STEPS = ["문서 등록", "사본 발급", "배포본 받기"];

/** 발급 흐름에서 들고 다니는 원본 정보. 서버에 원본 이미지 조회 API 가 없어 미리보기는 브라우저에 있는 파일로 보여준다 */
export interface RegisteredDoc extends DocumentCreated {
  previewUrl: string;
}

const FEATURES = [
  { icon: "scan", title: "보이지 않는 워터마크", desc: ["사람 눈에 띄지 않게", "식별 정보를 넣습니다."] },
  { icon: "user", title: "받는 사람별 사본", desc: ["사본마다 고유한", "사본 ID가 부여됩니다."] },
  { icon: "share", title: "배포 계보 기록", desc: ["누가 누구에게 전달했는지", "사본 대장에 남깁니다."] },
] as const;

interface DocumentRegisterPageProps {
  onRegistered: (doc: RegisteredDoc) => void;
  onBack: () => void;
}

/** 07 문서 등록 — 제목과 원본 이미지를 받아 POST /api/documents */
export function DocumentRegisterPage({ onRegistered, onBack }: DocumentRegisterPageProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  // 등록에 성공해 다음 화면으로 넘긴 미리보기 URL 은 여기서 해제하지 않는다
  const handedOff = useRef<string | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    return () => {
      if (previewUrl && handedOff.current !== previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pick(picked: File) {
    const invalid = validateUpload(picked);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setFile(picked);
    setSize(null);
    setPreviewUrl(URL.createObjectURL(picked));
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ""));
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    setSize(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && !busy) pick(dropped);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("문서 제목을 입력해주세요.");
      return;
    }
    if (!file || !previewUrl) {
      setError("원본 이미지를 선택해주세요.");
      return;
    }
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const doc = await api.registerDocument(title.trim(), file, ctrl.signal);
      handedOff.current = previewUrl;
      onRegistered({ ...doc, previewUrl });
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err));
    } finally {
      if (requestRef.current === ctrl) setBusy(false);
    }
  }

  return (
    <AppShell step={1} steps={ISSUE_STEPS} breadcrumb={["문서 관리", "새 문서 등록"]} onBack={onBack}>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) pick(picked);
        }}
      />

      <div className="page-head">
        <p className="eyebrow">DOCUMENT REGISTRATION</p>
        <h1>배포할 원본 문서를 등록하세요.</h1>
        <p>등록한 원본에서 받는 사람마다 워터마크가 들어간 사본을 발급합니다.</p>
      </div>

      <form className="card form-card" onSubmit={submit} noValidate>
        {error && (
          <p className="banner banner-error" role="alert">
            <Icon name="alert" size={18} />
            {error}
          </p>
        )}

        <label className="field">
          <span className="field-label">
            문서 제목 <span className="req">*</span>
          </span>
          <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: OLED 설계도" maxLength={100} />
        </label>

        <div className="field">
          <span className="field-label">
            원본 이미지 <span className="req">*</span>
            <span className="field-hint">PNG, JPG, JPEG · 최대 50MB</span>
          </span>

          {file && previewUrl ? (
            <div className="picked">
              <div className="picked-thumb">
                <img src={previewUrl} alt={`${file.name} 미리보기`} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
              </div>
              <div className="picked-body">
                <div className="file-confirm-title">
                  <h2>{file.name}</h2>
                  <span className="pill pill-green">
                    <Icon name="check" size={13} strokeWidth={2.6} />
                    등록 가능
                  </span>
                </div>
                <p className="file-confirm-sub">
                  {formatFromName(file.name)} | {formatBytes(file.size)}
                  {size && ` | ${formatResolution(size.w, size.h)}`}
                </p>
              </div>
              <button type="button" className="icon-btn picked-close" aria-label="선택한 이미지 지우기" onClick={clearFile} disabled={busy}>
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
              <Icon name="cloudUpload" size={56} strokeWidth={1.4} className="dropzone-icon" />
              <p className="dropzone-title">원본 이미지를 여기에 끌어다 놓으세요.</p>
              <button type="button" className="btn btn-primary btn-pick" onClick={() => inputRef.current?.click()}>
                <Icon name="file" size={18} />
                이미지 선택
              </button>
            </div>
          )}
        </div>

        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="refresh" size={18} />
            {file ? "다른 이미지 선택" : "이미지 선택"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "등록하는 중…" : "문서 등록"}
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </form>

      <ul className="feature-row">
        {FEATURES.map((f) => (
          <li key={f.title} className="feature-card">
            <span className="feature-icon">
              <Icon name={f.icon} size={22} />
            </span>
            <strong>{f.title}</strong>
            <p>
              {f.desc[0]}
              <br />
              {f.desc[1]}
            </p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
