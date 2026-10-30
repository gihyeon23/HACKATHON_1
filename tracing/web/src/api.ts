export type Actor = { id?: string; name: string; org: string; phone?: string; device?: string };

export type PathNode = {
  actor: Actor;
  external: boolean;
  event: string;
  at_kst: string;
  hash: string;
  signature_ok: boolean;
  reopened_kst: string[];
  log_match: boolean;
};

export type LedgerLine = { seq: number; event: string; actor: Actor; at_kst: string; hash: string };

export type TreeNode = {
  hash: string;
  actor: Actor;
  event: string;
  at_kst: string;
  in_file: boolean;
  children: TreeNode[];
};

export type Tree = { rows: number; roots: TreeNode[]; branch_points: number };

export type TraceResult = {
  doc_id: string;
  title: string;
  registered: boolean;
  integrity: { ok: boolean; broken_at: number | null; reasons: string[] };
  path: PathNode[];
  first_external: { from: string; to: string; at_kst: string; branched: boolean } | null;
  last_holder: Actor | null;
  ledger_lines: number;
  trusted_lines: number;
  untrusted: LedgerLine[];
  server_log: { state: "match" | "mismatch" | "empty"; rows: number; after_file: LedgerLine[]; tree: Tree };
};

export type OpenResult = {
  hck_b64: string;
  image_b64: string;
  image_mime: string;
  parent: LedgerLine;
  ledger: LedgerLine[];
  title: string;
  doc_id: string;
};

export type Overview = {
  documents: number;
  opens: number;
  external_opens: number;
  log_rows: number;
  logs_wiped: boolean;
  demo_mode: boolean;
  recent: { title: string | null; event: string; actor: Actor; external: boolean; at_kst: string }[];
};

export type DocRow = {
  doc_id: string;
  title: string;
  created_by: Actor;
  created_at_kst: string | null;
  opens: number;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail).catch(() => null);
    throw new ApiError(res.status, typeof detail === "string" ? detail : "요청을 처리하지 못했습니다.");
  }
  return res;
}

const getJson = async <T,>(url: string) => (await request(url)).json() as Promise<T>;

function form(fields: Record<string, string | Blob>) {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  return f;
}

export const api = {
  overview: () => getJson<Overview>("/api/overview"),
  docs: () => getJson<DocRow[]>("/api/docs-list"),
  tree: (docId: string) => getJson<Tree>(`/api/docs-list/${encodeURIComponent(docId)}/tree`),
  trace: async (file: Blob) =>
    (await request("/api/trace", { method: "POST", body: form({ file }) })).json() as Promise<TraceResult>,
  open: async (file: Blob, actor: object) =>
    (await request("/api/hck/open", { method: "POST", body: form({ file, actor: JSON.stringify(actor) }) })).json() as Promise<OpenResult>,
  create: async (image: Blob, title: string, actor: object) =>
    (await request("/api/hck/create", { method: "POST", body: form({ image, title, actor: JSON.stringify(actor) }) })).blob(),
  tamper: async (file: Blob) => (await request("/api/demo/tamper", { method: "POST", body: form({ file }) })).blob(),
  sampleImage: async () => (await request("/api/demo/sample-image")).blob(),
  wipeLogs: () => request("/api/demo/wipe-logs", { method: "POST" }),
  restoreLogs: () => request("/api/demo/restore-logs", { method: "POST" }),
  reset: () => request("/api/demo/reset", { method: "POST" }),
};

export const clock = (kst: string) => kst.slice(11);

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
