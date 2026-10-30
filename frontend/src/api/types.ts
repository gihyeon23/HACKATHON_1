/** docs/API_SPEC.md 8장 TypeScript 타입 그대로 (고치지 말고 명세가 바뀌면 다시 복사) */

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

