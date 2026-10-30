import { useEffect, useId, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { verifyPath, type VerifiedPath } from "./lineage";
import type { InvestigationApi } from "./types";

export function DistributionPathModal({
  api,
  copyCode,
  filename,
  onClose,
}: {
  api: InvestigationApi;
  copyCode: string;
  filename: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [path, setPath] = useState<VerifiedPath | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setPath(null);
    setError(null);
    api
      .getPath(copyCode, controller.signal)
      .then((value) => {
        if (!alive || controller.signal.aborted) return;
        if (value.identifiedCopyCode !== copyCode)
          throw new Error("요청한 사본과 다른 경로입니다.");
        setPath(verifyPath(value));
      })
      .catch((reason) => {
        if (alive && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "배포 경로를 불러오지 못했습니다.",
          );
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api, copyCode, attempt]);
  return (
    <Modal labelledBy={titleId} onClose={onClose} className="path-modal">
      <header className="path-modal-header">
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="배포 경로 닫기"
        >
          <Icon name="close" size={24} />
        </button>
        <div className="path-modal-heading">
          <div>
            <p className="eyebrow">DOCUMENT TRACEABILITY</p>
            <h2 id={titleId}>문서 배포 경로</h2>
            <p>
              식별된 사본을 기준으로 최초 원본까지의 등록된 배포 관계를
              확인합니다.
            </p>
          </div>
          <div className="identified-file">
            <span>
              <Icon name="doc" size={31} />
            </span>
            <div>
              <strong>{filename}</strong>
              <small>사본 {copyCode}</small>
            </div>
          </div>
        </div>
      </header>
      <section className="path-panel" aria-label="배포 계보">
        <div className="path-panel-heading">
          <h3>
            {path?.status === "partial" || path?.status === "invalid"
              ? "확인이 필요한 배포 계보"
              : "확인된 배포 계보"}
          </h3>
          <p>
            {path?.status === "complete"
              ? `총 ${path.nodes.length}단계 · 등록된 사본 관계`
              : path?.status === "partial"
                ? "일부 연결이 확인되지 않았습니다."
                : "원본과 부모 사본 관계를 조회합니다."}
          </p>
          {api.mode === "mock" && <span className="mock-tag">DEMO</span>}
        </div>
        <div className="path-scroll" tabIndex={0} aria-label="배포 계보 목록">
          {error ? (
            <div className="path-empty" role="alert">
              <Icon name="alert" size={35} />
              <strong>배포 경로를 불러오지 못했습니다.</strong>
              <p>{error}</p>
              <button
                className="button outline small"
                onClick={() => setAttempt((n) => n + 1)}
                type="button"
              >
                다시 시도
              </button>
            </div>
          ) : !path ? (
            <div className="path-empty" role="status">
              <span className="loading-spinner" />
              <strong>등록된 배포 관계를 확인하고 있습니다.</strong>
            </div>
          ) : (
            <>
              {path.status !== "complete" && (
                <div className="path-warning" role="status">
                  <Icon name="info" size={18} />
                  <div>
                    {path.reasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                </div>
              )}
              {path.nodes.length ? (
                <ol className="path-list">
                  {path.nodes.map((node, index) => {
                    const original = node.kind === "document";
                    const identified = node.copyCode === copyCode;
                    return (
                      <li key={node.copyCode}>
                        <article
                          className={`path-node ${identified ? "path-node-identified" : ""}`}
                        >
                          <div className="path-step">
                            <strong>{index + 1}단계</strong>
                            <span>{original ? "원본" : "사본"}</span>
                          </div>
                          <span className="path-node-icon">
                            <Icon
                              name={
                                original
                                  ? "doc"
                                  : node.kind === "partner"
                                    ? "building"
                                    : "user"
                              }
                              size={38}
                            />
                          </span>
                          <div className="path-node-name">
                            <h4>{node.name}</h4>
                            <p>{node.copyCode}</p>
                          </div>
                          <span
                            className={`path-node-tag ${identified ? "path-node-tag-identified" : ""}`}
                          >
                            {identified
                              ? "식별된 사본"
                              : original
                                ? "원본 문서"
                                : "중간 사본"}
                          </span>
                        </article>
                        {index < path.nodes.length - 1 && (
                          <div className="path-connector" aria-hidden="true">
                            <span>↓</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                path.status !== "invalid" && (
                  <div className="path-empty">
                    <Icon name="doc" size={35} />
                    <strong>표시할 등록 경로가 없습니다.</strong>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </section>
      <footer className="path-modal-footer">
        <Icon name="info" size={23} />
        <p>
          이 결과는 등록된 배포 계보를 보여주며 실제 유출자를 확정하지 않습니다.
          <small>배포 시각 정보는 제공되지 않습니다.</small>
        </p>
      </footer>
    </Modal>
  );
}
