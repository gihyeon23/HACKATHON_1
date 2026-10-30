import { useEffect, useRef, useState, type DragEvent } from "react";
import { api, ApiRequestError, errorMessage, isAbortError } from "../api/client";
import type { UploadedFile } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { formatBytes, formatResolution, validateUpload } from "../lib/format";

const FEATURES = [
  { icon: "lock", title: "안전한 분석", desc: ["업로드한 파일은 암호화되어", "안전하게 처리됩니다."] },
  { icon: "scan", title: "자동 워터마크 검출", desc: ["이미지에서 식별 정보를", "자동으로 분석합니다."] },
  { icon: "share", title: "배포 경로 추적", desc: ["등록된 문서와 사본의", "전달 경로를 확인합니다."] },
] as const;

type Busy = "upload" | "demo" | "start" | null;

interface UploadPageProps {
  /** 다른 화면에서 돌아올 때 보여줄 안내 (예: 취소로 파일이 삭제됨) */
  notice?: string;
  onStarted: (analysisId: string, file: UploadedFile) => void;
  /** 배포본 발급 흐름으로 (보조 링크) */
  onIssue: () => void;
}

/**
 * 02 파일 업로드 + 2.1 분석 시작(파일 확인).
 * 파일이 올라가면 같은 화면에서 파일 정보와 "분석 시작" · "다른 파일 선택" 버튼을 보여준다.
 */
export function UploadPage({ notice, onStarted, onIssue }: UploadPageProps) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  // 화면을 떠나면 진행 중인 업로드 요청을 끊는다
  useEffect(() => () => requestRef.current?.abort(), []);

  function beginRequest(kind: Busy) {
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setBusy(kind);
    setError(null);
    setInfo(null);
    return ctrl;
  }

  async function upload(picked: File) {
    const invalid = validateUpload(picked);
    if (invalid) {
      setError(invalid);
      setInfo(null);
      return;
    }
    const ctrl = beginRequest("upload");
    try {
      const uploaded = await api.uploadFile(picked, ctrl.signal);
      setFile(uploaded);
      setThumbFailed(false);
    } catch (e) {
      if (!isAbortError(e)) setError(errorMessage(e));
    } finally {
      if (requestRef.current === ctrl) setBusy(null);
    }
  }

  async function uploadDemo() {
    const ctrl = beginRequest("demo");
    try {
      const uploaded = await api.uploadDemo(ctrl.signal);
      setFile(uploaded);
      setThumbFailed(false);
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof ApiRequestError && e.code === "DEMO_NOT_READY") {
        setError("데모 이미지가 아직 준비되지 않았습니다. 직접 이미지를 올려주세요.");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      if (requestRef.current === ctrl) setBusy(null);
    }
  }

  async function startAnalysis() {
    if (!file) return;
    const ctrl = beginRequest("start");
    try {
      const { analysisId } = await api.createAnalysis(file.fileId, ctrl.signal);
      onStarted(analysisId, file);
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof ApiRequestError && e.code === "FILE_NOT_FOUND") {
        setFile(null);
        setError("업로드한 파일을 찾을 수 없습니다. 보관 기간이 지났을 수 있으니 다시 올려주세요.");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      if (requestRef.current === ctrl) setBusy(null);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) void upload(dropped);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!busy) setDragOver(true);
  }

  return (
    <AppShell step={1} breadcrumb={["유출 조사", "새 조사 시작"]}>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) void upload(picked);
        }}
      />

      <div className="page-head">
        <p className="eyebrow">DOCUMENT TRACEABILITY</p>
        <h1>유출된 문서를 업로드하세요.</h1>
        <p>이미지에 삽입된 워터마크를 분석하여 사본을 식별하고, 확인된 배포 경로를 추적합니다.</p>
      </div>

      <div className="upload-area">
        {info && (
          <p className="banner banner-info" role="status">
            <Icon name="info" size={18} />
            {info}
          </p>
        )}
        {error && (
          <p className="banner banner-error" role="alert">
            <Icon name="alert" size={18} />
            {error}
          </p>
        )}

        {file ? (
          <section className="file-confirm" aria-labelledby="file-confirm-name">
            <div className="file-confirm-top">
              <div className="file-confirm-thumb">
                {thumbFailed ? (
                  <Icon name="image" size={36} />
                ) : (
                  <img src={api.fileImageUrl(file.fileId)} alt={`${file.name} 미리보기`} onError={() => setThumbFailed(true)} />
                )}
              </div>
              <div className="file-confirm-body">
                <div className="file-confirm-title">
                  <h2 id="file-confirm-name">{file.name}</h2>
                  <span className="pill pill-green">
                    <Icon name="check" size={13} strokeWidth={2.6} />
                    분석 가능
                  </span>
                </div>
                <p className="file-confirm-sub">
                  {file.format} | {formatBytes(file.size)} | {formatResolution(file.width, file.height)}
                </p>
                <dl className="file-confirm-rows">
                  <div>
                    <dt>
                      <Icon name="file" size={16} />
                      파일 형식
                    </dt>
                    <dd>{file.format} (이미지 파일)</dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="file" size={16} />
                      파일 크기
                    </dt>
                    <dd>{formatBytes(file.size)} (최대 50MB 이하)</dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="file" size={16} />
                      해상도
                    </dt>
                    <dd>{formatResolution(file.width, file.height)}</dd>
                  </div>
                </dl>
              </div>
              <button
                type="button"
                className="icon-btn file-confirm-close"
                aria-label="선택한 파일 지우기"
                disabled={busy === "start"}
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={startAnalysis} disabled={busy !== null}>
              {busy === "start" ? "분석 요청 중…" : "분석 시작"}
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={openPicker} disabled={busy !== null}>
              <Icon name="refresh" size={16} />
              {busy === "upload" ? "업로드 중…" : "다른 파일 선택"}
            </button>
          </section>
        ) : (
          <div
            className={`dropzone${dragOver ? " is-over" : ""}${busy ? " is-busy" : ""}`}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <Icon name="cloudUpload" size={84} strokeWidth={1.4} className="dropzone-icon" />
            <p className="dropzone-title">{busy === "upload" ? "파일을 업로드하고 있습니다…" : "파일을 여기에 끌어다 놓으세요."}</p>
            <p className="dropzone-desc">PNG, JPG, JPEG 파일을 지원합니다. (최대 50MB)</p>
            <button type="button" className="btn btn-primary btn-pick" onClick={openPicker} disabled={busy !== null}>
              <Icon name="file" size={18} />
              파일 선택
            </button>
          </div>
        )}

        <div className="divider">
          <span>또는</span>
        </div>
        <button type="button" className="demo-card" onClick={uploadDemo} disabled={busy !== null}>
          <span className="demo-card-icon">
            <Icon name="file" size={22} />
          </span>
          <span className="demo-card-text">
            <strong>{busy === "demo" ? "데모 이미지를 준비하고 있습니다…" : "데모 이미지로 체험하기"}</strong>
            <span>샘플 문서로 분석 결과를 바로 확인해보세요.</span>
          </span>
          <Icon name="chevronRight" size={20} />
        </button>
        <button type="button" className="issue-link" onClick={onIssue}>
          아직 배포본이 없나요? <b>워터마크 사본 발급하기</b>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </button>
      </div>

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
