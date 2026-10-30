import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError, errorMessage, isAbortError } from "../api/client";
import type { AnalysisStatus, AnalysisStep, UploadedFile } from "../api/types";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { formatBytes, formatElapsed, formatResolution } from "../lib/format";

const POLL_INTERVAL_MS = 1000;

// 단계 설명은 API 에 없어 key 기준으로 고정한다
const STEP_DESC: Record<AnalysisStep["key"], string> = {
  VALIDATE: "업로드 파일을 검증하고 이미지 형식을 확인합니다.",
  WATERMARK: "이미지에서 워터마크를 검출하고 사본 식별 정보를 복원합니다.",
  LOOKUP: "식별된 사본의 배포 기록과 연결된 원본 문서를 조회합니다.",
};

// 서버 응답 전에 보여줄 자리 (이름은 응답이 오면 서버 값으로 바뀐다)
const PLACEHOLDER_STEPS: AnalysisStep[] = [
  { key: "VALIDATE", name: "파일 검증 및 전처리", status: "PENDING", progress: 0, elapsedMs: null },
  { key: "WATERMARK", name: "워터마크 분석", status: "PENDING", progress: 0, elapsedMs: null },
  { key: "LOOKUP", name: "문서 및 배포 기록 조회", status: "PENDING", progress: 0, elapsedMs: null },
];

// 워터마크 단계 세부 문구는 API 에 없어 steps[1].progress 구간으로 바꾼다
const WATERMARK_DETAILS = [
  { until: 40, text: "주파수 영역에서 워터마크 패턴을 분석하는 중입니다." },
  { until: 75, text: "식별 정보를 복원하고 있습니다." },
  { until: 101, text: "등록된 사본과 비교하고 있습니다." },
];

/** 30% 미만 회색, 30% 이상 초록색 */
function progressTone(progress: number) {
  return progress >= 30 ? "is-green" : "is-gray";
}

interface ProgressPageProps {
  analysisId: string;
  file: UploadedFile;
  onCompleted: () => void;
  /** 업로드 화면으로 돌아간다. notice 는 업로드 화면에 띄울 안내 */
  onExit: (notice?: string) => void;
}

export function ProgressPage({ analysisId, file, onCompleted, onExit }: ProgressPageProps) {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [thumbFailed, setThumbFailed] = useState(false);

  // 취소 버튼에서도 폴링을 바로 멈출 수 있게 타이머와 요청을 ref 로 둔다
  const pollRef = useRef<{ ctrl: AbortController; timer?: number } | null>(null);
  const cancelCtrlRef = useRef<AbortController | null>(null);
  const callbacks = useRef({ onCompleted, onExit });
  callbacks.current = { onCompleted, onExit };

  function stopPolling() {
    const poll = pollRef.current;
    if (!poll) return;
    poll.ctrl.abort();
    window.clearTimeout(poll.timer);
    pollRef.current = null;
  }

  useEffect(() => {
    const poll: { ctrl: AbortController; timer?: number } = { ctrl: new AbortController() };
    pollRef.current = poll;

    async function tick() {
      try {
        const s = await api.getAnalysis(analysisId, poll.ctrl.signal);
        if (poll.ctrl.signal.aborted) return;
        setStatus(s);
        setPollError(null);
        // 종료 판단은 단계 상태가 아니라 최상위 status 로만 한다
        if (s.status === "RUNNING") {
          poll.timer = window.setTimeout(tick, POLL_INTERVAL_MS);
        } else if (s.status === "COMPLETED") {
          // 100% 를 잠깐 보여준 뒤 결과 화면으로
          poll.timer = window.setTimeout(() => callbacks.current.onCompleted(), 600);
        } else if (s.status === "CANCELED") {
          callbacks.current.onExit("분석이 취소되었습니다. 업로드한 파일이 삭제되어 다시 올려야 합니다.");
        }
        // FAILED 는 화면에 실패 사유를 보여준다
      } catch (e) {
        if (isAbortError(e) || poll.ctrl.signal.aborted) return;
        if (e instanceof ApiRequestError && e.code === "ANALYSIS_NOT_FOUND") {
          callbacks.current.onExit("분석 정보를 찾을 수 없습니다. 파일을 다시 올려주세요.");
          return;
        }
        setPollError(errorMessage(e));
      }
    }
    void tick();

    return () => {
      poll.ctrl.abort();
      window.clearTimeout(poll.timer);
      if (pollRef.current === poll) pollRef.current = null;
    };
  }, [analysisId, pollKey]);

  useEffect(() => () => cancelCtrlRef.current?.abort(), []);

  async function cancel() {
    setCanceling(true);
    setCancelError(null);
    stopPolling();
    const ctrl = new AbortController();
    cancelCtrlRef.current = ctrl;
    try {
      await api.cancelAnalysis(analysisId, ctrl.signal);
    } catch (e) {
      if (isAbortError(e)) return;
      // 이미 끝난 분석(409 ANALYSIS_FINISHED)은 무시하고 업로드 화면으로 간다
      if (!(e instanceof ApiRequestError && e.code === "ANALYSIS_FINISHED")) {
        setCanceling(false);
        setCancelError(errorMessage(e));
        setPollKey((k) => k + 1);
        return;
      }
    }
    callbacks.current.onExit("분석을 취소했습니다. 업로드한 파일은 삭제되어 다시 올려야 합니다.");
  }

  const steps = status?.steps ?? PLACEHOLDER_STEPS;
  const overall = status?.progress ?? 0;
  const failed = status?.status === "FAILED";
  const finished = status !== null && status.status !== "RUNNING";
  const watermark = steps[1];
  const detailIndex =
    watermark.status === "DONE"
      ? WATERMARK_DETAILS.length
      : WATERMARK_DETAILS.findIndex((d) => watermark.progress < d.until);

  return (
    <AppShell step={2} breadcrumb={["유출 조사", "새 조사 시작"]}>
      <div className="page-head">
        <h1>{failed ? "분석을 완료하지 못했습니다." : "파일을 분석하고 있습니다."}</h1>
        <p>이미지에서 식별 정보를 검출하고, 등록된 문서와 사본을 조회합니다.</p>
      </div>

      {failed && (
        <div className="banner banner-error banner-block" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <strong>{status.failureMessage ?? "분석하지 못했습니다."}</strong>
            <span>다른 파일로 다시 분석해 주세요.</span>
          </div>
        </div>
      )}
      {pollError && (
        <div className="banner banner-error banner-block" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <strong>진행 상태를 불러오지 못했습니다.</strong>
            <span>{pollError}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPollKey((k) => k + 1)}>
            다시 시도
          </button>
        </div>
      )}
      {cancelError && (
        <p className="banner banner-error" role="alert">
          <Icon name="alert" size={18} />
          분석을 취소하지 못했습니다. {cancelError}
        </p>
      )}

      <div className="progress-grid">
        <section className="card steps-card" aria-label="분석 단계">
          <div className="overall">
            <div className="overall-head">
              <span>전체 진행률</span>
              <b className={progressTone(overall)}>{overall}%</b>
            </div>
            <div
              className="bar"
              role="progressbar"
              aria-label="전체 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={overall}
            >
              <span className={`bar-fill ${progressTone(overall)}`} style={{ width: `${overall}%` }} />
            </div>
          </div>

          <ol className="steps" aria-live="polite">
            {steps.map((step, i) => (
              <li key={step.key} className={`step is-${step.status.toLowerCase()}`}>
                <span className="step-icon" aria-hidden="true">
                  {step.status === "DONE" ? <Icon name="check" size={16} strokeWidth={3} /> : step.status === "RUNNING" ? <span className="spinner" /> : <span className="step-dot" />}
                </span>
                <div className="step-body">
                  <div className="step-head">
                    <h2>
                      <span className="step-no">{i + 1}.</span>
                      {step.name}
                      <span className="sr-only">
                        {step.status === "DONE" ? " 완료" : step.status === "RUNNING" ? " 진행 중" : " 대기"}
                      </span>
                    </h2>
                    <div className="step-meta">
                      {step.status === "RUNNING" && <b className={progressTone(step.progress)}>{step.progress}%</b>}
                      <span>{formatElapsed(step.elapsedMs)}</span>
                    </div>
                  </div>
                  <p>{STEP_DESC[step.key]}</p>
                  {step.status === "RUNNING" && (
                    <div className="bar bar-sm" aria-hidden="true">
                      <span className={`bar-fill ${progressTone(step.progress)}`} style={{ width: `${step.progress}%` }} />
                    </div>
                  )}
                  {step.key === "WATERMARK" && step.status !== "PENDING" && (
                    <ul className="step-details">
                      {WATERMARK_DETAILS.map((d, di) => (
                        <li key={d.text} className={di === detailIndex ? "is-active" : di < detailIndex ? "is-done" : undefined}>
                          {d.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="card file-card" aria-label="분석 중인 파일">
          <div className="file-card-head">
            <span className={`pill ${failed ? "pill-red" : finished ? "pill-green" : "pill-blue"}`}>
              <Icon name="info" size={13} />
              {failed ? "분석 실패" : finished ? "분석 완료" : "분석 진행 중"}
            </span>
            <span className="muted-xs">보통 수 초 안에 끝납니다</span>
          </div>
          <div className="file-card-thumb">
            {thumbFailed ? (
              <Icon name="image" size={40} />
            ) : (
              <img src={api.fileImageUrl(file.fileId)} alt={`${file.name} 미리보기`} onError={() => setThumbFailed(true)} />
            )}
          </div>
          <p className="file-card-name">{file.name}</p>
          <dl className="meta-grid">
            <div>
              <dt>파일 크기</dt>
              <dd>{formatBytes(file.size)}</dd>
            </div>
            <div>
              <dt>해상도</dt>
              <dd>{formatResolution(file.width, file.height)}</dd>
            </div>
            <div>
              <dt>파일 형식</dt>
              <dd>{file.format}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {!failed && (
        <div className="secure-note">
          <span className="secure-note-icon">
            <Icon name="lock" size={20} />
          </span>
          <div>
            <strong>안전하게 분석하고 있습니다.</strong>
            <p>업로드된 파일은 암호화되어 처리되며, 분석 완료 후 자동으로 안전하게 삭제됩니다.</p>
          </div>
        </div>
      )}

      <div className="center-actions">
        {failed ? (
          <button type="button" className="btn btn-primary" onClick={() => onExit()}>
            <Icon name="refresh" size={18} />
            다른 파일 분석하기
          </button>
        ) : (
          <button type="button" className="btn btn-outline btn-cancel" onClick={cancel} disabled={canceling || finished}>
            {canceling ? "취소하는 중…" : "분석 취소"}
          </button>
        )}
      </div>
    </AppShell>
  );
}
