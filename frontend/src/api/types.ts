// docs/API_SPEC.md 8장 TypeScript 타입을 그대로 옮긴 것. 명세가 바뀌면 여기도 같이 바꾼다.

export type ImageFormat = "PNG" | "JPEG";
export type RecipientType = "EMPLOYEE" | "PARTNER";

export interface ApiError { error: string; code?: string; }

export interface UploadedFile {
  fileId: string; name: string; size: number; width: number; height: number; format: ImageFormat;
}

export interface AnalysisCreated { analysisId: string; }

export type AnalysisStatusValue = "RUNNING" | "COMPLETED" | "CANCELED" | "FAILED";
export type FailureReason = "NO_DOCUMENT" | "NOT_FOUND" | "NOT_REGISTERED" | "ENGINE_ERROR" | "INTERNAL_ERROR";

export interface AnalysisStep {
  key: "VALIDATE" | "WATERMARK" | "LOOKUP";
  name: string;
  status: "PENDING" | "RUNNING" | "DONE";
  progress: number;          // 0~100
  elapsedMs: number | null;  // 시작 전이면 null
}

export interface AnalysisStatus {
  analysisId: string;
  fileId: string;
  status: AnalysisStatusValue;
  failureReason: FailureReason | null;
  failureMessage: string | null;
  progress: number;          // 0~100
  elapsedMs: number;
  steps: [AnalysisStep, AnalysisStep, AnalysisStep];
}

export interface PathNode {
  code: string;
  name: string;
  type: "ORIGINAL" | "COPY";
  role: "원본 문서" | "중간 사본" | "식별된 사본";
  recipientType: RecipientType | null;
}

export interface AnalysisResult {
  analysisId: string;
  copyCode: string;
  recipientName: string;
  recipientType: RecipientType;
  document: { docCode: string; title: string };
  z: number;
  threshold: number;
  detectionLevel: "HIGH" | "MEDIUM" | "LOW";
  via: string | null;
  analyzedAt: string;        // ISO-8601, 타임존 없음 (서버 KST)
  method: string;
  file: UploadedFile;
  distributionSteps: number; // = path.length
  pathSummary: string;
  path: PathNode[];
}

// ===== 부록 A (문서 등록 · 사본 발급) =====
// 명세서 8장에 타입이 없어 백엔드 DTO(DocumentResponse · CopyResponse · RecipientResponse) 기준으로 작성했다.

export interface DocumentCreated {
  docCode: string;
  title: string;
  width: number | null;
  height: number | null;
  createdAt: string;         // ISO-8601, 타임존 없음 (서버 KST)
}

export interface CopyIssued {
  copyCode: string;
  recipientId: number;
  docCode: string;
  name: string;
  recipientType: RecipientType;
  parentCopyCode: string | null;
  width: number | null;
  height: number | null;
  strength: number | null;
  predictedZ: number | null;
  threshold: number | null;
  psnr: number | null;       // 삽입 화질 (dB)
  ssim: number | null;       // 구조 유사도 0~1
  elapsedMs: number | null;
  fileUrl: string;
}

export interface RecipientEntry {
  recipientId: number;
  copyCode: string;
  parentCopyCode: string | null;
  docCode: string | null;
  name: string;
  recipientType: RecipientType;
  width: number | null;
  height: number | null;
  createdAt: string;
}

// ===== 보호 파일 (.hck) =====
// 백엔드 HckOpenResponse 기준. 파일에는 이미지가 없고, 열 때마다 서버가 열람자 워터마크 사본을 준다.

export type HckEvent = "ISSUE" | "OPEN" | "CLAIM";

export interface HckLedgerLine {
  seq: number;
  event: HckEvent;          // ISSUE: 플랫폼 발급 / OPEN: 뷰어로 열어 열람자 사본 발급 / CLAIM: 사본 주인이 처음 열어 기기 연결
  copyCode: string;
  name: string;
  recipientType: RecipientType | null;
}

export interface HckOpened {
  hckBase64: string;        // 장부가 갱신된 새 .hck (다른 사람에게 전달할 때 이 파일을 보낸다)
  docCode: string;
  title: string;
  copyCode: string;         // 열람자 사본. imageUrl 이미지에 이 사본의 워터마크가 들어 있다
  name: string;
  parentCopyCode: string | null;
  parentName: string | null;
  reopened: boolean;        // 같은 기기가 다시 열었거나 사본 주인이 연 경우 (새 사본 없음)
  imageUrl: string;
  ledger: HckLedgerLine[];
}
