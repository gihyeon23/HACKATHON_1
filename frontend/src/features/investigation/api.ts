import type {
  AnalysisJob,
  AnalysisResult,
  CopyPath,
  InvestigationApi,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ApiError(0, "서버 응답 형식이 올바르지 않습니다.");
  return v as Record<string, unknown>;
};
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
function fileValid(v: unknown): boolean {
  const f = record(v);
  return (
    str(f.id) &&
    str(f.name) &&
    finite(f.sizeBytes) &&
    f.sizeBytes >= 0 &&
    finite(f.width) &&
    finite(f.height) &&
    f.width > 0 &&
    f.height > 0 &&
    str(f.mimeType) &&
    (f.imageUrl == null || typeof f.imageUrl === "string")
  );
}
const malformed = () =>
  new ApiError(
    0,
    "서버 응답이 화면 계약과 일치하지 않습니다. API 명세를 확인해 주세요.",
  );

export function parseJob(value: unknown): AnalysisJob {
  const v = record(value);
  if (
    !str(v.id) ||
    !["queued", "running", "completed", "failed", "cancelled"].includes(
      String(v.status),
    ) ||
    !["validation", "watermark", "lineage"].includes(String(v.phase)) ||
    !fileValid(v.file) ||
    !(
      v.progress === null ||
      (finite(v.progress) && v.progress >= 0 && v.progress <= 100)
    ) ||
    !(
      v.elapsedSeconds === null ||
      (finite(v.elapsedSeconds) && v.elapsedSeconds >= 0)
    ) ||
    !(
      v.phaseElapsedSeconds == null ||
      (finite(v.phaseElapsedSeconds) && v.phaseElapsedSeconds >= 0)
    ) ||
    !(v.message == null || typeof v.message === "string") ||
    !(v.error == null || typeof v.error === "string")
  )
    throw malformed();
  return v as unknown as AnalysisJob;
}

export function parseResult(value: unknown): AnalysisResult {
  const v = record(value);
  if (
    !str(v.analysisId) ||
    !["identified", "not_detected", "unlinked", "failed"].includes(
      String(v.status),
    ) ||
    !fileValid(v.file) ||
    !(v.copyCode === null || str(v.copyCode)) ||
    !Array.isArray(v.summary) ||
    !v.summary.every((x) => typeof x === "string") ||
    !(v.method === null || typeof v.method === "string") ||
    !(
      v.analyzedAt === null ||
      (typeof v.analyzedAt === "string" &&
        Number.isFinite(Date.parse(v.analyzedAt)))
    ) ||
    !(
      v.distributionSteps === null ||
      (Number.isInteger(v.distributionSteps) &&
        Number(v.distributionSteps) >= 0)
    ) ||
    !(v.error == null || typeof v.error === "string")
  )
    throw malformed();
  if (v.document !== null) {
    const d = record(v.document);
    if (
      !str(d.code) ||
      !str(d.title) ||
      !(d.imageUrl == null || typeof d.imageUrl === "string")
    )
      throw malformed();
  }
  if (v.score !== null) {
    const s = record(v.score);
    if (
      !finite(s.value) ||
      !["correlation", "zscore", "probability"].includes(String(s.kind)) ||
      typeof s.calibrated !== "boolean" ||
      !(s.threshold == null || finite(s.threshold))
    )
      throw malformed();
  }
  if (v.status === "identified" && (!v.copyCode || !v.document))
    throw malformed();
  return v as unknown as AnalysisResult;
}

export function parsePath(value: unknown): CopyPath {
  const v = record(value);
  if (
    !str(v.identifiedCopyCode) ||
    !str(v.documentCode) ||
    typeof v.complete !== "boolean" ||
    !Array.isArray(v.nodes) ||
    !Array.isArray(v.unverifiedSegments) ||
    !v.unverifiedSegments.every((x) => typeof x === "string")
  )
    throw malformed();
  for (const value of v.nodes) {
    const n = record(value);
    if (
      !str(n.copyCode) ||
      !(n.parentCopyCode === null || str(n.parentCopyCode)) ||
      !str(n.name) ||
      !["document", "employee", "partner", "other"].includes(String(n.kind))
    )
      throw malformed();
  }
  return v as unknown as CopyPath;
}

/** Gateway contract for backend #13. Do not call Flask/FastAPI engines directly. */
export function createInvestigationApi(
  fetcher: typeof fetch = fetch,
): InvestigationApi {
  async function request(
    path: string,
    signal: AbortSignal,
    method = "GET",
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`/api${path}`, {
        method,
        signal,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError(
        0,
        "분석 서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: unknown;
      };
      throw new ApiError(
        response.status,
        typeof body.error === "string"
          ? body.error
          : `요청을 완료하지 못했습니다. (${response.status})`,
      );
    }
    if (response.status === 204) return undefined;
    try {
      return await response.json();
    } catch {
      throw malformed();
    }
  }
  return {
    mode: "api",
    getAnalysis: async (id, signal) =>
      parseJob(await request(`/analyses/${encodeURIComponent(id)}`, signal)),
    cancelAnalysis: async (id, signal) => {
      await request(`/analyses/${encodeURIComponent(id)}`, signal, "DELETE");
    },
    getResult: async (id, signal) =>
      parseResult(
        await request(`/analyses/${encodeURIComponent(id)}/result`, signal),
      ),
    getPath: async (copy, signal) =>
      parsePath(
        await request(`/copies/${encodeURIComponent(copy)}/path`, signal),
      ),
  };
}
