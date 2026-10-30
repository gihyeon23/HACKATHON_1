export type AnalysisPhase = "validation" | "watermark" | "lineage";
export type AnalysisStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface InvestigationFile {
  id: string;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
  imageUrl?: string;
}

export interface AnalysisJob {
  id: string;
  status: AnalysisStatus;
  phase: AnalysisPhase;
  progress: number | null;
  elapsedSeconds: number | null;
  phaseElapsedSeconds?: number | null;
  message?: string;
  error?: string;
  file: InvestigationFile;
}

export interface DetectionScore {
  value: number;
  kind: "correlation" | "zscore" | "probability";
  calibrated: boolean;
  threshold?: number;
}

export interface AnalysisResult {
  analysisId: string;
  status: "identified" | "not_detected" | "unlinked" | "failed";
  file: InvestigationFile;
  copyCode: string | null;
  document: { code: string; title: string; imageUrl?: string } | null;
  score: DetectionScore | null;
  analyzedAt: string | null;
  method: string | null;
  distributionSteps: number | null;
  summary: string[];
  error?: string;
}

export interface CopyNode {
  copyCode: string;
  parentCopyCode: string | null;
  name: string;
  kind: "document" | "employee" | "partner" | "other";
}

export interface CopyPath {
  identifiedCopyCode: string;
  documentCode: string;
  nodes: CopyNode[];
  complete: boolean;
  unverifiedSegments: string[];
}

export interface InvestigationApi {
  readonly mode: "mock" | "api";
  getAnalysis(id: string, signal: AbortSignal): Promise<AnalysisJob>;
  cancelAnalysis(id: string, signal: AbortSignal): Promise<void>;
  getResult(id: string, signal: AbortSignal): Promise<AnalysisResult>;
  getPath(copyCode: string, signal: AbortSignal): Promise<CopyPath>;
}
