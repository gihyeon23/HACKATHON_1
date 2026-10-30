/** backend `/api` 호출은 여기서만 · 명세: docs/API_SPEC.md */
import type { AnalysisCreated, UploadedFile } from "./types";

export type * from "./types";

/** .env 의 VITE_API_BASE_URL (예: http://localhost:8080) · 비우면 같은 주소의 /api (vite 프록시) */
const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(BASE + url, init);
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? "요청을 처리하지 못했습니다.", body?.code);
  }
  return res;
}

const json = async <T,>(url: string, init?: RequestInit) => (await request(url, init)).json() as Promise<T>;

export const api = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return json<UploadedFile>("/api/files", { method: "POST", body: form });
  },
  uploadDemo: () => json<UploadedFile>("/api/files/demo", { method: "POST" }),
  imageUrl: (fileId: string) => `${BASE}/api/files/${encodeURIComponent(fileId)}/image`,
  startAnalysis: (fileId: string) =>
    json<AnalysisCreated>("/api/analyses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }),
    }),
};

export const formatSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${(n / 1024).toFixed(1)}KB`);

