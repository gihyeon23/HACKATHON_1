import { Icon } from "../../components/Icon";
import { FilePreview } from "../../components/FilePreview";
import { InvestigationLayout } from "../../components/InvestigationLayout";
import { formatBytes, formatTime } from "./lineage";
import { useAnalysisJob } from "./useAnalysisJob";
import type { InvestigationApi, InvestigationFile } from "./types";

const phases = [
  {
    id: "validation",
    title: "파일 검증 및 전처리",
    description: "업로드 파일을 검증하고 이미지 형식을 확인합니다.",
  },
  {
    id: "watermark",
    title: "워터마크 분석",
    description: "이미지에서 워터마크를 검출하고 사본 식별 정보를 확인합니다.",
  },
  {
    id: "lineage",
    title: "문서 및 배포 기록 조회",
    description: "식별된 사본의 배포 기록과 연결된 원본 문서를 조회합니다.",
  },
] as const;

export function AnalysisProgressPage({
  api,
  analysisId,
  file,
  onCompleted,
  onCancelled,
}: {
  api: InvestigationApi;
  analysisId: string;
  file?: InvestigationFile;
  onCompleted: (id: string) => void;
  onCancelled: () => void;
}) {
  const { job, error, loading, cancelling, cancel, retry } = useAnalysisJob(
    api,
    analysisId,
    { onCompleted, onCancelled },
  );
  const current = phases.findIndex((phase) => phase.id === job?.phase);
  const selectedFile = job?.file ?? file;
  return (
    <InvestigationLayout
      step={2}
      mock={api.mode === "mock"}
      onUpload={() => void cancel()}
    >
      <section className="page-heading">
        <h1>
          {cancelling
            ? "분석 취소를 요청하고 있습니다."
            : error
              ? "분석 상태를 확인해 주세요."
              : "파일을 분석하고 있습니다."}
        </h1>
        <p>이미지에서 식별 정보를 검출하고, 등록된 문서와 사본을 조회합니다.</p>
      </section>
      {error && (
        <div className="error-panel" role="alert">
          <Icon name="alert" />
          <div>
            <strong>분석 상태 확인이 필요합니다.</strong>
            <p>{error}</p>
          </div>
          <button
            className="button outline small"
            type="button"
            onClick={retry}
            disabled={cancelling}
          >
            상태 다시 확인
          </button>
        </div>
      )}
      <div className="progress-columns">
        <section className="card phase-card" aria-label="단계별 분석 진행">
          {phases.map((phase, index) => {
            const done = job?.status === "completed" || index < current;
            const active = index === current && job?.status === "running";
            return (
              <div
                key={phase.id}
                className={`phase ${done ? "phase-done" : active ? "phase-current" : ""}`}
              >
                <span className="phase-marker">
                  {done ? (
                    <Icon name="check" size={25} />
                  ) : active ? (
                    <span className="phase-spinner" />
                  ) : (
                    <span className="pending-dot" />
                  )}
                </span>
                <div className="phase-body">
                  <div className="phase-title">
                    <span className="phase-number">{index + 1}.</span>
                    <h2>{phase.title}</h2>
                    <div className="phase-clock">
                      {active && job?.progress != null && (
                        <strong>{job.progress}%</strong>
                      )}
                      <span>
                        {active
                          ? formatTime(
                              job?.phaseElapsedSeconds ?? job?.elapsedSeconds,
                            )
                          : done
                            ? "완료"
                            : "—"}
                      </span>
                    </div>
                  </div>
                  <p>{phase.description}</p>
                  {active && (
                    <>
                      <div
                        className={`progress-track ${job?.progress == null ? "is-indeterminate" : job.progress >= 30 ? "progress-green" : "progress-gray"}`}
                        role="progressbar"
                        aria-label="전체 분석 진행률"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={job?.progress ?? undefined}
                      >
                        <span
                          style={{
                            width:
                              job?.progress == null
                                ? "35%"
                                : `${job.progress}%`,
                          }}
                        />
                      </div>
                      <div className="phase-detail">
                        <div>
                          <span className="detail-dot" />
                          {job?.message ||
                            "서버가 전달한 분석 상태를 확인하고 있습니다."}
                        </div>
                        <small>
                          전체 진행률 ·{" "}
                          {job?.progress == null
                            ? "서버에서 수치를 제공하지 않았습니다."
                            : `${job.progress}%`}
                        </small>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <p className="status-message" role="status">
              분석 작업의 상태를 불러오고 있습니다.
            </p>
          )}
        </section>
        <aside className="card progress-file-card">
          <div className="file-status-row">
            <span className={`badge ${error ? "badge-warning" : ""}`}>
              <Icon name="info" size={15} />
              {cancelling
                ? "취소 요청 중"
                : error
                  ? "상태 확인 필요"
                  : loading
                    ? "상태 조회 중"
                    : "분석 진행 중"}
            </span>
            <small>경과 시간 {formatTime(job?.elapsedSeconds)}</small>
          </div>
          {selectedFile ? (
            <>
              <FilePreview
                name={selectedFile.name}
                url={selectedFile.imageUrl}
              />
              <h2>{selectedFile.name}</h2>
              <dl className="file-facts">
                <div>
                  <dt>파일 크기</dt>
                  <dd>{formatBytes(selectedFile.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>해상도</dt>
                  <dd>
                    {selectedFile.width} × {selectedFile.height}
                  </dd>
                </div>
                <div>
                  <dt>파일 형식</dt>
                  <dd>
                    {selectedFile.mimeType.split("/").pop()?.toUpperCase()}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="status-message">
              서버가 파일 정보를 제공하기를 기다리고 있습니다.
            </p>
          )}
        </aside>
      </div>
      <div className="policy-notice">
        <span className="policy-icon">
          <Icon name="lock" size={27} />
        </span>
        <div>
          <strong>
            {api.mode === "mock"
              ? "샘플 데이터로 화면 흐름을 확인하고 있습니다."
              : "서버의 분석 상태를 확인하고 있습니다."}
          </strong>
          <p>
            {api.mode === "mock"
              ? "DEMO 모드는 실제 파일 분석을 실행하지 않습니다."
              : "진행 상태와 결과는 서버 응답을 기준으로 표시합니다. 취소하려면 아래 버튼을 이용해 주세요."}
          </p>
        </div>
      </div>
      <div className="cancel-row">
        <button
          className="button outline"
          type="button"
          onClick={() => void cancel()}
          disabled={cancelling}
        >
          {cancelling ? "취소 요청 중…" : "분석 취소"}
        </button>
      </div>
    </InvestigationLayout>
  );
}
