import type {
  AnalysisCreated,
  AnalysisResult,
  AnalysisStatus,
  ApiError,
  CopyIssued,
  DocumentCreated,
  HckOpened,
  PathNode,
  RecipientEntry,
  RecipientType,
  UploadedFile,
} from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/** 서버 오류 응답({ error, code? }) 또는 네트워크 실패. 분기는 code 로, 화면 문구는 message 로 한다. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** 컴포넌트에서 catch 한 오류를 사용자에게 보여줄 문구로 바꾼다. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  return "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

function fallbackMessage(status: number): string {
  if (status === 502 || status === 503 || status === 504) return "잠시 후 다시 시도해주세요.";
  if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했습니다.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new ApiRequestError(0, "서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.");
  }

  if (!res.ok) {
    let body: Partial<ApiError> = {};
    try {
      body = (await res.json()) as Partial<ApiError>;
    } catch {
      // 본문이 JSON 이 아니면(프록시 오류 등) 상태 코드 기준 문구를 쓴다
    }
    throw new ApiRequestError(res.status, body.error || fallbackMessage(res.status), body.code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function json(body: unknown): RequestInit {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  /** POST /api/files — Content-Type 은 브라우저가 boundary 와 함께 넣도록 지정하지 않는다 */
  uploadFile(file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append("file", file);
    return request<UploadedFile>("/api/files", { method: "POST", body: form, signal });
  },

  uploadDemo(signal?: AbortSignal) {
    return request<UploadedFile>("/api/files/demo", { method: "POST", signal });
  },

  /** GET /api/files/{fileId}/image — <img src> 로 바로 쓴다 */
  fileImageUrl(fileId: string) {
    return `${BASE_URL}/api/files/${encodeURIComponent(fileId)}/image`;
  },

  createAnalysis(fileId: string, signal?: AbortSignal) {
    return request<AnalysisCreated>("/api/analyses", { method: "POST", ...json({ fileId }), signal });
  },

  getAnalysis(analysisId: string, signal?: AbortSignal) {
    return request<AnalysisStatus>(`/api/analyses/${encodeURIComponent(analysisId)}`, { signal });
  },

  cancelAnalysis(analysisId: string, signal?: AbortSignal) {
    return request<void>(`/api/analyses/${encodeURIComponent(analysisId)}`, { method: "DELETE", signal });
  },

  getResult(analysisId: string, signal?: AbortSignal) {
    return request<AnalysisResult>(`/api/analyses/${encodeURIComponent(analysisId)}/result`, { signal });
  },

  getCopyPath(copyCode: string, signal?: AbortSignal) {
    return request<PathNode[]>(`/api/copies/${encodeURIComponent(copyCode)}/path`, { signal });
  },

  /** POST /api/documents — 원본 문서 등록 */
  registerDocument(title: string, image: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append("title", title);
    form.append("image", image);
    return request<DocumentCreated>("/api/documents", { method: "POST", body: form, signal });
  },

  /** POST /api/documents/{docCode}/copies — 받는 사람별 워터마크 사본 발급 (엔진 호출이라 수 초 걸림) */
  issueCopy(
    docCode: string,
    copy: { name: string; recipientType: RecipientType; parentCopyCode: string | null },
    signal?: AbortSignal,
  ) {
    const form = new FormData();
    form.append("name", copy.name);
    form.append("recipientType", copy.recipientType);
    if (copy.parentCopyCode) form.append("parentCopyCode", copy.parentCopyCode);
    return request<CopyIssued>(`/api/documents/${encodeURIComponent(docCode)}/copies`, { method: "POST", body: form, signal });
  },

  /** GET /api/recipients — 사본 대장 */
  listRecipients(signal?: AbortSignal) {
    return request<RecipientEntry[]>("/api/recipients", { signal });
  },

  /** GET /api/copies/{copyCode}/file — 배포본 PNG. download 면 첨부파일로 내려받는다 */
  copyFileUrl(copyCode: string, download = false) {
    return `${BASE_URL}/api/copies/${encodeURIComponent(copyCode)}/file${download ? "?download=1" : ""}`;
  },

  /** GET /api/copies/{copyCode}/hck — 보호 파일(.hck) 내려받기 */
  copyHckUrl(copyCode: string) {
    return `${BASE_URL}/api/copies/${encodeURIComponent(copyCode)}/hck`;
  },

  /** POST /api/hck/open — 보호 파일 열기. 처음 여는 기기면 열람자 사본을 발급한다 (엔진 호출이라 수 초 걸림) */
  openHck(
    file: Blob,
    viewer: { name: string; recipientType: RecipientType; viewerId: string },
    signal?: AbortSignal,
  ) {
    const form = new FormData();
    form.append("file", file, "protected.hck");
    form.append("name", viewer.name);
    form.append("recipientType", viewer.recipientType);
    form.append("viewerId", viewer.viewerId);
    return request<HckOpened>("/api/hck/open", { method: "POST", body: form, signal });
  },
};
