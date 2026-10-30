import { useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "../api/client";
import type { PathNode } from "../api/types";
import { AppShell } from "../components/AppShell";
import { DistributionPathModal } from "../components/DistributionPathModal";

/** 개발용: GET /api/copies/{copyCode}/path 결과를 배포 경로 모달로 띄운다 (실제 서버 데이터) */
export function PathPreviewPage({ copyCode }: { copyCode: string }) {
  const [path, setPath] = useState<PathNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getCopyPath(copyCode, ctrl.signal)
      .then(setPath)
      .catch((e) => {
        if (!isAbortError(e)) setError(errorMessage(e));
      });
    return () => ctrl.abort();
  }, [copyCode]);

  return (
    <AppShell step={3} breadcrumb={["개발용", "배포 경로 미리보기", copyCode]}>
      <div className="page-head">
        <h1>배포 경로 미리보기</h1>
        <p>{error ?? (path ? `${copyCode} · ${path.length}단계` : "불러오는 중…")}</p>
        {path && !open && (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            모달 다시 열기
          </button>
        )}
      </div>
      {path && open && <DistributionPathModal path={path} fileName="(경로 API 직접 조회)" copyCode={copyCode} onClose={() => setOpen(false)} />}
    </AppShell>
  );
}
