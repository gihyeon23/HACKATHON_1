import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, errorMessage, isAbortError } from "../api/client";
import type { CopyIssued, PathNode, RecipientEntry, RecipientType } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon, type IconName } from "../components/Icon";
import { formatResolution, recipientLabel } from "../lib/format";
import { ISSUE_STEPS, type RegisteredDoc } from "./DocumentRegisterPage";

function nodeIcon(type: RecipientType | null): IconName {
  if (type === "EMPLOYEE") return "user";
  if (type === "PARTNER") return "building";
  return "file";
}

interface CopyIssuePageProps {
  doc: RegisteredDoc;
  onIssued: (copy: CopyIssued) => void;
}

/** 08 사본 발급 — 받는 사람 · 유형 · 전달받은 사본을 받아 POST /api/documents/{docCode}/copies */
export function CopyIssuePage({ doc, onIssued }: CopyIssuePageProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RecipientType>("EMPLOYEE");
  const [parent, setParent] = useState("");
  const [copies, setCopies] = useState<RecipientEntry[]>([]);
  const [parentPath, setParentPath] = useState<PathNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  // 전달받은 사본 후보: 이 문서에서 이미 발급한 사본
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .listRecipients(ctrl.signal)
      .then((all) => setCopies(all.filter((r) => r.docCode === doc.docCode)))
      .catch((e) => {
        if (!isAbortError(e)) setError(`사본 대장을 불러오지 못했습니다. ${errorMessage(e)}`);
      });
    return () => ctrl.abort();
  }, [doc.docCode]);

  // 미리보기 경로는 서버의 경로 API 결과에 새 사본 한 칸을 붙여서 보여준다
  useEffect(() => {
    if (!parent) {
      setParentPath(null);
      return;
    }
    const ctrl = new AbortController();
    api
      .getCopyPath(parent, ctrl.signal)
      .then(setParentPath)
      .catch((e) => {
        if (!isAbortError(e)) setParentPath(null);
      });
    return () => ctrl.abort();
  }, [parent]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("받는 사람 이름을 입력해주세요.");
      return;
    }
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.issueCopy(doc.docCode, { name: name.trim(), recipientType: type, parentCopyCode: parent || null }, ctrl.signal);
      onIssued(copy);
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err));
    } finally {
      if (requestRef.current === ctrl) setBusy(false);
    }
  }

  const origin: PathNode = { code: doc.docCode, name: doc.title, type: "ORIGINAL", role: "원본 문서", recipientType: null };
  const base = parent ? (parentPath ?? []) : [origin];
  const total = base.length + 1;

  return (
    <AppShell step={2} steps={ISSUE_STEPS} breadcrumb={["문서 관리", doc.title, "사본 발급"]}>
      <div className="page-head">
        <h1>사본을 받을 사람을 지정하세요.</h1>
        <p>받는 사람마다 고유한 사본 ID가 워터마크로 들어갑니다. 전달 관계는 사본 대장에 기록됩니다.</p>
      </div>

      <div className="issue-grid">
        <form className="card form-card form-card-wide" onSubmit={submit} noValidate>
          {error && (
            <p className="banner banner-error" role="alert">
              <Icon name="alert" size={18} />
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">
              받는 사람 이름 <span className="req">*</span>
            </span>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 직원 B, 협력사 C" maxLength={50} />
          </label>

          <fieldset className="field">
            <legend className="field-label">
              받는 사람 유형 <span className="req">*</span>
            </legend>
            <div className="segmented" role="radiogroup">
              {(["EMPLOYEE", "PARTNER"] as const).map((t) => (
                <label key={t} className={`segmented-item${type === t ? " is-on" : ""}`}>
                  <input type="radio" name="recipientType" value={t} checked={type === t} onChange={() => setType(t)} />
                  <Icon name={nodeIcon(t)} size={20} />
                  {recipientLabel(t)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="field-label">
              전달받은 사본
              <span className="field-hint">이 사람에게 사본을 넘겨준 사람</span>
            </span>
            <span className="select-wrap">
              <select className="text-input" value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">없음 (원본에서 직접)</option>
                {copies.map((c) => (
                  <option key={c.copyCode} value={c.copyCode}>
                    {c.copyCode} · {c.name} ({recipientLabel(c.recipientType)})
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={20} className="select-chevron" />
            </span>
            <span className="field-help">원본에서 바로 배포한다면 '없음 (원본에서 직접)'을 선택하세요.</span>
          </label>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                워터마크를 넣는 중…
              </>
            ) : (
              <>
                <Icon name="plus" size={18} />
                사본 발급
              </>
            )}
          </button>
          <p className="field-help center">워터마크를 넣는 데 몇 초 걸립니다.</p>
        </form>

        <aside className="card issue-side" aria-label="원본 문서와 발급 후 배포 경로">
          <span className="pill pill-blue">
            <Icon name="file" size={13} />
            원본 문서
          </span>
          <div className="issue-side-thumb">
            <img src={doc.previewUrl} alt={`${doc.title} 원본`} />
          </div>
          <p className="issue-side-title">{doc.title}</p>
          <p className="muted-xs">
            {doc.docCode}
            {doc.width && doc.height ? ` · ${formatResolution(doc.width, doc.height)}` : ""}
          </p>

          <div className="mini-path-head">
            <b>발급 후 배포 경로</b>
            <span className="muted-xs">총 {total}단계</span>
          </div>
          <ol className="mini-path">
            {base.map((n, i) => (
              <li key={n.code}>
                <div className="mini-node">
                  <span className="mini-step">
                    <b>{i + 1}단계</b>
                    {n.type === "ORIGINAL" ? "원본" : "사본"}
                  </span>
                  <span className="mini-icon">
                    <Icon name={nodeIcon(n.recipientType)} size={16} />
                  </span>
                  <span className="mini-body">
                    <b>{n.name}</b>
                    <span>{n.code}</span>
                  </span>
                </div>
                <Icon name="arrowDown" size={16} className="mini-arrow" />
              </li>
            ))}
            <li>
              <div className="mini-node is-new">
                <span className="mini-step">
                  <b>{total}단계</b>
                  사본
                </span>
                <span className="mini-icon">
                  <Icon name={nodeIcon(type)} size={16} />
                </span>
                <span className="mini-body">
                  <b>{name.trim() || "받는 사람"}</b>
                  <span className="text-blue">발급 후 사본 ID 부여</span>
                </span>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      <div className="secure-note">
        <span className="secure-note-icon">
          <Icon name="lock" size={20} />
        </span>
        <div>
          <strong>발급한 사본은 사본 대장에 기록됩니다.</strong>
          <p>나중에 유출 이미지를 분석하면 이 기록으로 원본까지의 배포 경로를 보여줍니다. 실제 유출자를 확정하지는 않습니다.</p>
        </div>
      </div>
    </AppShell>
  );
}
