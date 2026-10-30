import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError, errorMessage, isAbortError } from "../api/client";
import type { AnalysisResult } from "../api/types";
import { AppShell } from "../components/AppShell";
import { DistributionPathModal } from "../components/DistributionPathModal";
import { Icon } from "../components/Icon";
import { ImageViewer } from "../components/ImageViewer";
import { detectionLabel, detectionScore, formatAnalyzedAt, formatBytes, formatResolution } from "../lib/format";

// 결과가 COMPLETED 면 모두 성립하는 고정 문구 (API_SPEC 5장)
const SUMMARY = [
  "업로드한 이미지에서 워터마크를 성공적으로 검출했습니다.",
  "검출된 사본 ID가 등록된 배포 기록과 일치합니다.",
  "해당 사본의 배포 경로를 추적할 수 있습니다.",
];

// 결과 대신 업로드 화면으로 돌려보낼 오류
const BACK_TO_UPLOAD = new Set(["ANALYSIS_NOT_FOUND", "ANALYSIS_CANCELED"]);

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; result: AnalysisResult };

interface ResultPageProps {
  analysisId: string;
  onRestart: (notice?: string) => void;
}

export function ResultPage({ analysisId, onRestart }: ResultPageProps) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    api
      .getResult(analysisId, ctrl.signal)
      .then((result) => setState({ kind: "ready", result }))
      .catch((e) => {
        if (isAbortError(e)) return;
        if (e instanceof ApiRequestError && e.code && BACK_TO_UPLOAD.has(e.code)) {
          onRestartRef.current("분석 결과를 찾을 수 없습니다. 파일을 다시 올려주세요.");
          return;
        }
        setState({ kind: "error", message: errorMessage(e) });
      });
    return () => ctrl.abort();
  }, [analysisId, reloadKey]);

  const breadcrumb = ["유출 조사", "새 조사 시작", "분석 결과"];

  if (state.kind !== "ready") {
    return (
      <AppShell step={3} breadcrumb={breadcrumb}>
        {state.kind === "loading" ? (
          <p className="loading" role="status">
            <span className="spinner" aria-hidden="true" />
            분석 결과를 불러오고 있습니다…
          </p>
        ) : (
          <div className="result-error">
            <div className="banner banner-error banner-block" role="alert">
              <Icon name="alert" size={20} />
              <div>
                <strong>분석 결과를 불러오지 못했습니다.</strong>
                <span>{state.message}</span>
              </div>
            </div>
            <div className="center-actions">
              <button type="button" className="btn btn-outline" onClick={() => onRestart()}>
                다른 파일 분석하기
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
                다시 시도
              </button>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  const r = state.result;
  const level = detectionLabel(r.detectionLevel);
  const imageUrl = api.fileImageUrl(r.file.fileId);

  return (
    <AppShell step={3} breadcrumb={breadcrumb}>
      <div className="result-hero">
        <span className="result-hero-icon" aria-hidden="true">
          <Icon name="check" size={40} strokeWidth={3} />
        </span>
        <h1>문서 사본을 식별했습니다.</h1>
      </div>
      <p className="result-hero-desc">업로드한 이미지에서 워터마크가 검출되었으며, 등록된 배포 기록과 연결된 사본을 확인했습니다.</p>

      <section className="card result-card" aria-label="분석 파일 정보">
        <div className="result-thumb">
          {thumbFailed ? (
            <Icon name="image" size={40} />
          ) : (
            <img src={imageUrl} alt={`${r.file.name} 미리보기`} onError={() => setThumbFailed(true)} />
          )}
          <button type="button" className="result-thumb-expand" onClick={() => setViewerOpen(true)} aria-label="원본 크게 보기">
            <Icon name="expand" size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="result-info">
          <div className="result-info-head">
            <div>
              <h2>{r.file.name}</h2>
              <p className="result-meta">
                <span>{formatBytes(r.file.size)}</span>
                <span>{formatResolution(r.file.width, r.file.height)}</span>
                <span>{r.file.format}</span>
              </p>
            </div>
            <div className="result-info-actions">
              <span className="pill pill-green pill-lg">
                <Icon name="check" size={15} strokeWidth={2.6} />
                식별 완료
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewerOpen(true)}>
                <Icon name="external" size={16} />
                원본 보기
              </button>
            </div>
          </div>

          <div className="result-info-cols">
            <dl className="kv">
              <div>
                <dt>사본 ID</dt>
                <dd>{r.copyCode}</dd>
              </div>
              <div>
                <dt>원본 문서</dt>
                <dd>
                  {r.document.title} <span className="muted">({r.document.docCode})</span>
                </dd>
              </div>
              <div>
                <dt>검출 신뢰도</dt>
                <dd>
                  <span className={`level level-${r.detectionLevel.toLowerCase()}`}>{level}</span>
                </dd>
              </div>
            </dl>
            <dl className="kv kv-side">
              <div>
                <dt>분석 일시</dt>
                <dd>{formatAnalyzedAt(r.analyzedAt)}</dd>
              </div>
              <div>
                <dt>분석 방식</dt>
                <dd>{r.method}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <ul className="stat-row">
        <li className="card stat">
          <span className="stat-icon">
            <Icon name="file" size={26} />
          </span>
          <div>
            <span className="stat-label">식별된 사본</span>
            <b className="stat-value">{r.copyCode}</b>
            <span className="stat-sub">검출 신뢰도 {level}</span>
          </div>
        </li>
        <li className="card stat">
          <span className="stat-icon">
            <Icon name="file" size={26} />
          </span>
          <div>
            <span className="stat-label">원본 문서</span>
            <b className="stat-value">{r.document.title}</b>
            <span className="stat-sub">{r.document.docCode}</span>
          </div>
        </li>
        <li className="card stat">
          <span className="stat-icon">
            <Icon name="layers" size={26} />
          </span>
          <div>
            <span className="stat-label">배포 단계</span>
            <b className="stat-value">{r.distributionSteps}단계</b>
            <span className="stat-sub">{r.pathSummary}</span>
          </div>
        </li>
      </ul>

      <section className="summary" aria-labelledby="summary-title">
        <div className="summary-head">
          <h2 id="summary-title">분석 요약</h2>
          <button
            type="button"
            className={`summary-toggle${detailOpen ? " is-open" : ""}`}
            aria-expanded={detailOpen}
            aria-controls="summary-body"
            onClick={() => setDetailOpen((v) => !v)}
          >
            <Icon name="chevronDown" size={18} />
            {detailOpen ? "상세 분석 닫기" : "상세 분석 보기"}
          </button>
        </div>
        {detailOpen && (
          <div id="summary-body" className="summary-body">
            <ul className="summary-list">
              {SUMMARY.map((line) => (
                <li key={line}>
                  <span className="summary-check" aria-hidden="true">
                    <Icon name="check" size={13} strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="summary-score">
              {detectionScore(r.z, r.threshold)} · 검출 등급 {level}
            </p>
          </div>
        )}
        <p className="summary-disclaimer">
          <Icon name="info" size={16} />
          이 결과는 등록된 배포 계보를 보여주며 실제 유출자를 확정하지 않습니다.
        </p>
      </section>

      <div className="result-actions">
        <button type="button" className="btn btn-outline btn-lg" onClick={() => onRestart()}>
          <Icon name="refresh" size={20} />
          다른 파일 분석하기
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setPathOpen(true)}>
          배포 경로 확인하기
          <Icon name="arrowRight" size={20} />
        </button>
      </div>

      {pathOpen && (
        <DistributionPathModal path={r.path} fileName={r.file.name} copyCode={r.copyCode} onClose={() => setPathOpen(false)} />
      )}
      {viewerOpen && <ImageViewer src={imageUrl} name={r.file.name} onClose={() => setViewerOpen(false)} />}
    </AppShell>
  );
}
