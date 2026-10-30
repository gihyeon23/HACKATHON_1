import { useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "../api/client";
import type { CopyIssued, RecipientEntry } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { formatResolution, recipientLabel } from "../lib/format";
import { ISSUE_STEPS, type RegisteredDoc } from "./DocumentRegisterPage";

interface CopyIssuedPageProps {
  doc: RegisteredDoc;
  copy: CopyIssued;
  onIssueAnother: () => void;
  onAnalyze: () => void;
}

/** 09 발급 완료 · 사본 대장 — 배포본 다운로드와 이 문서의 사본 대장(GET /api/recipients) */
export function CopyIssuedPage({ doc, copy, onIssueAnother, onAnalyze }: CopyIssuedPageProps) {
  const [ledger, setLedger] = useState<RecipientEntry[] | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .listRecipients(ctrl.signal)
      .then((all) => setLedger(all.filter((r) => r.docCode === doc.docCode)))
      .catch((e) => {
        if (!isAbortError(e)) setLedgerError(errorMessage(e));
      });
    return () => ctrl.abort();
  }, [doc.docCode, copy.copyCode]);

  const nameOf = (code: string | null) => ledger?.find((r) => r.copyCode === code)?.name;
  const parentText = (code: string | null) => (code ? `${code}${nameOf(code) ? ` · ${nameOf(code)}` : ""}` : "없음 (원본에서 직접)");

  return (
    <AppShell step={3} steps={ISSUE_STEPS} breadcrumb={["문서 관리", doc.title, "발급 완료"]}>
      <div className="result-hero">
        <span className="result-hero-icon" aria-hidden="true">
          <Icon name="check" size={40} strokeWidth={3} />
        </span>
        <h1>사본을 발급했습니다.</h1>
      </div>
      <p className="result-hero-desc">
        배포본을 내려받아 받는 사람에게 전달하세요. 유출되면 이 사본 ID로 배포 경로를 추적할 수 있습니다.
        <br />
        보호 파일(.hck)로 보내면 받은 사람이 카톡 · 이메일로 다시 넘겨도, 여는 사람마다 기록됩니다.
      </p>

      <section className="card result-card" aria-label="발급한 사본">
        <div className="result-thumb">
          {thumbFailed ? (
            <Icon name="image" size={40} />
          ) : (
            <img src={api.copyFileUrl(copy.copyCode)} alt={`${copy.copyCode} 배포본`} onError={() => setThumbFailed(true)} />
          )}
        </div>
        <div className="result-info">
          <div className="result-info-head">
            <div>
              <h2>{copy.copyCode}.png</h2>
              <p className="result-meta">
                {copy.width && copy.height && <span>{formatResolution(copy.width, copy.height)}</span>}
                <span>PNG</span>
              </p>
            </div>
            <div className="result-info-actions">
              <span className="pill pill-green pill-lg">
                <Icon name="check" size={15} strokeWidth={2.6} />
                발급 완료
              </span>
              <a className="btn btn-primary btn-sm" href={api.copyFileUrl(copy.copyCode, true)} download={`${copy.copyCode}.png`}>
                <Icon name="download" size={16} />
                배포본 다운로드
              </a>
              <a className="btn btn-outline btn-sm" href={api.copyHckUrl(copy.copyCode)} download={`${copy.copyCode}.hck`}>
                <Icon name="lock" size={16} />
                보호 파일(.hck)
              </a>
            </div>
          </div>
          <div className="result-info-cols">
            <dl className="kv">
              <div>
                <dt>사본 ID</dt>
                <dd>{copy.copyCode}</dd>
              </div>
              <div>
                <dt>받는 사람</dt>
                <dd>
                  {copy.name} <span className="muted">({recipientLabel(copy.recipientType)})</span>
                </dd>
              </div>
              <div>
                <dt>전달받은 사본</dt>
                <dd>{parentText(copy.parentCopyCode)}</dd>
              </div>
            </dl>
            <dl className="kv kv-side">
              <div>
                <dt>원본 문서</dt>
                <dd>
                  {doc.title} ({doc.docCode})
                </dd>
              </div>
              {copy.psnr !== null && copy.ssim !== null && (
                <div>
                  <dt>화질 (PSNR · SSIM)</dt>
                  <dd>
                    {copy.psnr.toFixed(1)} dB · {copy.ssim.toFixed(3)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="card ledger" aria-labelledby="ledger-title">
        <div className="ledger-head">
          <h2 id="ledger-title">사본 대장</h2>
          <span className="muted">
            {doc.title}
            {ledger && ` · 총 ${ledger.length}건`}
          </span>
        </div>
        {ledgerError ? (
          <p className="banner banner-error" role="alert">
            <Icon name="alert" size={18} />
            사본 대장을 불러오지 못했습니다. {ledgerError}
          </p>
        ) : !ledger ? (
          <p className="muted ledger-empty">불러오는 중…</p>
        ) : (
          <div className="ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">사본 ID</th>
                  <th scope="col">받는 사람</th>
                  <th scope="col">유형</th>
                  <th scope="col">전달받은 사본</th>
                  <th scope="col" className="right">
                    배포본
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.copyCode} className={r.copyCode === copy.copyCode ? "is-new" : undefined}>
                    <td>
                      <b>{r.copyCode}</b>
                      {r.copyCode === copy.copyCode && <span className="pill pill-blue ledger-new">방금 발급</span>}
                    </td>
                    <td>{r.name}</td>
                    <td>
                      <span className="ledger-type">
                        <Icon name={r.recipientType === "EMPLOYEE" ? "user" : "building"} size={18} />
                        {recipientLabel(r.recipientType)}
                      </span>
                    </td>
                    <td className="muted">{parentText(r.parentCopyCode)}</td>
                    <td className="right">
                      <a className="btn btn-outline btn-sm ledger-dl" href={api.copyFileUrl(r.copyCode, true)} download={`${r.copyCode}.png`}>
                        <Icon name="download" size={16} />
                        내려받기
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="summary-disclaimer">
          <Icon name="info" size={16} />
          사본 대장은 등록된 배포 기록이며, 배포 시각은 표시하지 않습니다.
        </p>
      </section>

      <div className="result-actions">
        <button type="button" className="btn btn-outline btn-lg" onClick={onIssueAnother}>
          <Icon name="plus" size={20} />
          사본 하나 더 발급
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onAnalyze}>
          유출 이미지 분석하기
          <Icon name="arrowRight" size={20} />
        </button>
      </div>
    </AppShell>
  );
}
