import { useId } from "react";
import type { PathNode } from "../api/types";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";

const TYPE_LABEL: Record<PathNode["type"], string> = { ORIGINAL: "원본", COPY: "사본" };

function nodeIcon(node: PathNode): IconName {
  if (node.recipientType === "EMPLOYEE") return "user";
  if (node.recipientType === "PARTNER") return "building";
  return "file";
}

interface DistributionPathModalProps {
  path: PathNode[];
  fileName: string;
  copyCode: string;
  onClose: () => void;
}

/**
 * 06 배포 경로 모달 (읽기 전용).
 * 카드 수 = path.length, 화살표 = path.length - 1 — 경로 길이를 고정하지 않는다.
 */
export function DistributionPathModal({ path, fileName, copyCode, onClose }: DistributionPathModalProps) {
  const titleId = useId();
  const lastIndex = path.length - 1;

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="path-modal">
      <header className="path-modal-head">
        <div>
          <p className="eyebrow">DOCUMENT TRACEABILITY</p>
          <h2 id={titleId}>문서 배포 경로</h2>
          <p className="path-modal-desc">식별된 사본을 기준으로 최초 원본까지의 배포 계보를 확인했습니다.</p>
        </div>
        <div className="path-modal-file">
          <span className="path-modal-file-icon">
            <Icon name="file" size={22} />
          </span>
          <div>
            <b>{fileName}</b>
            <span>사본 {copyCode}</span>
          </div>
        </div>
        <button type="button" className="icon-btn path-modal-close" onClick={onClose} aria-label="배포 경로 닫기">
          <Icon name="close" size={20} />
        </button>
      </header>

      <section className="path-panel" aria-labelledby={`${titleId}-list`}>
        <div className="path-panel-head">
          <h3 id={`${titleId}-list`}>확인된 배포 계보</h3>
          <span>총 {path.length}단계 · 등록된 사본 관계</span>
        </div>
        <ol className="path-list" tabIndex={0} aria-label={`배포 계보 ${path.length}단계`}>
          {path.map((node, i) => (
            <li key={node.code} className="path-item">
              <div className={`path-card${i === lastIndex ? " is-identified" : ""}`}>
                <div className="path-card-step">
                  <b>{i + 1}단계</b>
                  <span>{TYPE_LABEL[node.type]}</span>
                </div>
                <span className="path-card-icon">
                  <Icon name={nodeIcon(node)} size={26} />
                </span>
                <div className="path-card-body">
                  <b>{node.name}</b>
                  <span>{node.code}</span>
                </div>
                <span className="path-card-role">{node.role}</span>
              </div>
              {i < lastIndex && (
                <span className="path-arrow" aria-hidden="true">
                  <Icon name="arrowDown" size={26} strokeWidth={1.6} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="path-modal-foot">
        <Icon name="info" size={20} />
        <div>
          <p>이 결과는 등록된 배포 계보를 보여주며 실제 유출자를 확정하지 않습니다.</p>
          <span>배포 시각 정보는 제공되지 않습니다.</span>
        </div>
      </footer>
    </Modal>
  );
}
