import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { safeImageUrl } from "../features/investigation/lineage";

export function FilePreview({
  url,
  name,
  onExpand,
}: {
  url?: string;
  name: string;
  onExpand?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const source = safeImageUrl(url);
  useEffect(() => setBroken(false), [source]);
  return (
    <div className="file-preview">
      {source && !broken ? (
        <img
          key={source}
          src={source}
          alt={`${name} 미리보기`}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="image-fallback">
          <Icon name="doc" size={42} />
          <span>이미지 미리보기를 제공하지 않습니다.</span>
        </div>
      )}
      {onExpand && source && !broken && (
        <button
          type="button"
          className="expand-image"
          onClick={onExpand}
          aria-label="이미지 확대"
        >
          <Icon name="expand" size={18} />
        </button>
      )}
    </div>
  );
}
