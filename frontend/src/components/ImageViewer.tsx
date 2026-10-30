import { useId, useState } from "react";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface ImageViewerProps {
  src: string;
  name: string;
  onClose: () => void;
}

/** 원본 보기 — 업로드한 사진을 크게 보여준다. 보관 기간이 지나 404 면 안내 문구 */
export function ImageViewer({ src, name, onClose }: ImageViewerProps) {
  const titleId = useId();
  const [failed, setFailed] = useState(false);

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="viewer-modal">
      <header className="viewer-head">
        <h2 id={titleId}>원본 보기 · {name}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="원본 보기 닫기">
          <Icon name="close" size={20} />
        </button>
      </header>
      <div className="viewer-body">
        {failed ? (
          <p className="viewer-empty">
            <Icon name="alert" size={22} />
            원본 이미지를 불러올 수 없습니다. 분석 후 1시간이 지나 파일이 삭제되었을 수 있습니다.
          </p>
        ) : (
          <img src={src} alt={`${name} 원본`} onError={() => setFailed(true)} />
        )}
      </div>
    </Modal>
  );
}
