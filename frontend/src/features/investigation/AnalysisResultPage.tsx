import { useEffect, useId, useState } from "react";
import { Icon } from "../../components/Icon";
import { FilePreview } from "../../components/FilePreview";
import { Modal } from "../../components/Modal";
import { InvestigationLayout } from "../../components/InvestigationLayout";
import { DistributionPathModal } from "./DistributionPathModal";
import { formatBytes, formatScore, safeImageUrl } from "./lineage";
import type { AnalysisResult, InvestigationApi } from "./types";

const headings = {
  identified: {
    title: "문서 사본을 식별했습니다.",
    description:
      "업로드한 이미지에서 식별 정보를 검출하고, 등록된 배포 기록과 연결된 사본을 확인했습니다.",
  },
  not_detected: {
    title: "식별 가능한 패턴을 찾지 못했습니다.",
    description:
      "미검출이 워터마크가 없다는 증거는 아닙니다. 다른 이미지로 다시 확인할 수 있습니다.",
  },
  unlinked: {
    title: "검출된 정보의 등록 기록을 확인하지 못했습니다.",
    description:
      "식별 단서가 있어도 등록된 사본과 연결되지 않으면 배포 경로를 확정하지 않습니다.",
  },
  failed: {
    title: "파일 분석을 완료하지 못했습니다.",
    description: "오류 내용을 확인하고 다시 시도해 주세요.",
  },
};

export function AnalysisResultPage({
  api,
  analysisId,
  onUpload,
}: {
  api: InvestigationApi;
  analysisId: string;
  onUpload: () => void;
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pathOpen, setPathOpen] = useState(false);
  const [image, setImage] = useState<{ title: string; url: string } | null>(
    null,
  );
  const [imageError, setImageError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const imageTitleId = useId();
  const detailsId = useId();
  useEffect(() => {
    const request = new AbortController();
    let alive = true;
    setResult(null);
    setError(null);
    setPathOpen(false);
    setImage(null);
    setExpanded(false);
    api
      .getResult(analysisId, request.signal)
      .then((value) => {
        if (!alive || request.signal.aborted) return;
        if (value.analysisId !== analysisId)
          throw new Error("요청한 분석과 다른 결과입니다.");
        setResult(value);
      })
      .catch((reason) => {
        if (alive && !request.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "결과를 불러오지 못했습니다.",
          );
      });
    return () => {
      alive = false;
      request.abort();
    };
  }, [api, analysisId, attempt]);
  const openImage = (title: string, url?: string) => {
    const safe = safeImageUrl(url);
    if (safe) {
      setImageError(false);
      setImage({ title, url: safe });
    }
  };
  if (!result)
    return (
      <InvestigationLayout
        step={3}
        mock={api.mode === "mock"}
        onUpload={onUpload}
      >
        <section className="result-loading" role={error ? "alert" : "status"}>
          {error ? (
            <>
              <Icon name="alert" size={40} />
              <h1>결과를 불러오지 못했습니다.</h1>
              <p>{error}</p>
              <button
                className="button outline"
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
              >
                다시 시도
              </button>
            </>
          ) : (
            <>
              <span className="loading-spinner" />
              <h1>분석 결과를 확인하고 있습니다.</h1>
            </>
          )}
        </section>
      </InvestigationLayout>
    );
  const heading = headings[result.status];
  const found = result.status === "identified";
  const score = formatScore(result.score);
  const originalUrl = safeImageUrl(result.document?.imageUrl);
  return (
    <InvestigationLayout
      step={3}
      mock={api.mode === "mock"}
      onUpload={onUpload}
    >
      <section
        className={`result-heading ${found ? "" : "result-heading-warning"}`}
      >
        <div>
          <span className="result-status-icon">
            <Icon name={found ? "check" : "info"} size={42} />
          </span>
          <h1>{heading.title}</h1>
        </div>
        <p>{heading.description}</p>
      </section>
      {result.error && (
        <div className="error-panel" role="alert">
          <Icon name="alert" />
          <p>{result.error}</p>
        </div>
      )}
      <section className="card result-file-card">
        <FilePreview
          url={result.file.imageUrl}
          name={result.file.name}
          onExpand={() => openImage("업로드 이미지", result.file.imageUrl)}
        />
        <div className="result-file-content">
          <div className="result-file-top">
            <div>
              <h2>{result.file.name}</h2>
              <p>
                {formatBytes(result.file.sizeBytes)} <span>|</span>{" "}
                {result.file.width} × {result.file.height} <span>|</span>{" "}
                {result.file.mimeType.split("/").pop()?.toUpperCase()}
              </p>
            </div>
            <span
              className={`badge ${found ? "badge-success" : "badge-warning"}`}
            >
              <Icon name={found ? "check" : "info"} size={17} />
              {found
                ? "식별 완료"
                : result.status === "not_detected"
                  ? "미검출"
                  : "추가 확인 필요"}
            </span>
            <button
              type="button"
              className="button neutral small"
              onClick={() =>
                openImage("원본 이미지", result.document?.imageUrl)
              }
              disabled={!originalUrl}
            >
              <Icon name="external" size={18} />
              원본 보기
            </button>
          </div>
          <div className="result-file-bottom">
            <dl className="result-identifiers">
              <dt>사본 ID</dt>
              <dd>{result.copyCode ?? "식별되지 않음"}</dd>
              <dt>원본 문서</dt>
              <dd>
                {result.document ? (
                  <>
                    {result.document.title}{" "}
                    <span>({result.document.code})</span>
                  </>
                ) : (
                  "등록 정보 없음"
                )}
              </dd>
              <dt>{score.label}</dt>
              <dd>{score.value}</dd>
            </dl>
            <dl className="result-method">
              <dt>분석 일시</dt>
              <dd>
                {result.analyzedAt
                  ? new Intl.DateTimeFormat("ko-KR", {
                      timeZone: "Asia/Seoul",
                      dateStyle: "medium",
                      timeStyle: "medium",
                      hour12: false,
                    }).format(new Date(result.analyzedAt)) + " KST"
                  : "제공되지 않음"}
              </dd>
              <dt>분석 방식</dt>
              <dd>{result.method ?? "제공되지 않음"}</dd>
            </dl>
          </div>
        </div>
      </section>
      <div className="result-stat-grid">
        <section className="card result-stat">
          <span>
            <Icon name="doc" size={35} />
          </span>
          <div>
            <h3>식별된 사본</h3>
            <strong>{result.copyCode ?? "미확인"}</strong>
            <p>
              {score.label} {score.value}
            </p>
          </div>
        </section>
        <section className="card result-stat">
          <span>
            <Icon name="doc" size={35} />
          </span>
          <div>
            <h3>원본 문서</h3>
            <strong>{result.document?.title ?? "미확인"}</strong>
            <p>{result.document?.code ?? "등록 정보 없음"}</p>
          </div>
        </section>
        <section className="card result-stat">
          <span>
            <Icon name="layers" size={35} />
          </span>
          <div>
            <h3>배포 단계</h3>
            <strong>
              {result.distributionSteps == null
                ? "미확인"
                : `${result.distributionSteps}단계`}
            </strong>
            <p>등록된 사본 관계 기준</p>
          </div>
        </section>
      </div>
      <section className="analysis-summary">
        <div className="analysis-summary-heading">
          <h2>분석 요약</h2>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            <Icon name="chevronDown" size={18} />
            {expanded ? "상세 분석 접기" : "상세 분석 보기"}
          </button>
        </div>
        <ul>
          {result.summary.length ? (
            result.summary.map((line, index) => (
              <li key={`${index}-${line}`}>
                <Icon name={found ? "check" : "info"} size={18} />
                {line}
              </li>
            ))
          ) : (
            <li>서버에서 분석 요약을 제공하지 않았습니다.</li>
          )}
        </ul>
        <div id={detailsId} hidden={!expanded} className="analysis-details">
          <dl>
            <dt>검출 수치</dt>
            <dd>
              {score.label}: {score.value}
            </dd>
            <dt>임계값</dt>
            <dd>
              {result.score?.threshold == null
                ? "제공되지 않음"
                : result.score.threshold}
            </dd>
            <dt>해석</dt>
            <dd>{score.note || "표시할 검출 수치가 없습니다."}</dd>
          </dl>
          <p>
            패턴의 검출과 등록된 전달 관계는 별개의 증거입니다. 실제 유출 행위와
            책임은 별도 확인이 필요합니다.
          </p>
        </div>
      </section>
      <div className="result-actions">
        <button className="button outline" type="button" onClick={onUpload}>
          <Icon name="refresh" size={23} />
          다른 파일 분석하기
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!found || !result.copyCode}
          onClick={() => setPathOpen(true)}
        >
          배포 경로 확인하기
          <Icon name="arrow" size={24} />
        </button>
      </div>
      {!originalUrl && (
        <p className="missing-original">
          원본 이미지 주소가 제공되지 않아 원본 보기를 사용할 수 없습니다.
        </p>
      )}
      {pathOpen && result.copyCode && (
        <DistributionPathModal
          api={api}
          copyCode={result.copyCode}
          filename={result.file.name}
          onClose={() => setPathOpen(false)}
        />
      )}
      {image && (
        <Modal
          labelledBy={imageTitleId}
          onClose={() => setImage(null)}
          className="image-modal"
        >
          <header>
            <h2 id={imageTitleId}>{image.title}</h2>
            <button
              className="modal-close"
              type="button"
              aria-label="이미지 닫기"
              onClick={() => setImage(null)}
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="image-modal-body">
            {imageError ? (
              <p role="alert">이미지를 불러오지 못했습니다.</p>
            ) : (
              <img
                src={image.url}
                alt={image.title}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </Modal>
      )}
    </InvestigationLayout>
  );
}
