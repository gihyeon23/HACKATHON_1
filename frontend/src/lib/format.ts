import type { AnalysisResult, RecipientType } from "../api/types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg"];

/** 업로드 전에 확장자와 크기를 먼저 확인한다. 통과하면 null. */
export function validateUpload(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return "PNG, JPG, JPEG 파일만 지원합니다.";
  if (file.size > MAX_UPLOAD_BYTES) return "최대 50MB까지 올릴 수 있습니다.";
  return null;
}

/** 2483021 → "2.4MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatResolution(width: number, height: number): string {
  return `${width} × ${height}`;
}

/** 단계 경과 시간 → "00:03". 시작 전(null)이면 "-" */
export function formatElapsed(ms: number | null): string {
  if (ms === null) return "-";
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * analyzedAt 은 타임존 없는 서버(KST) 시각이라 Date 로 바꾸지 않고 문자열 그대로 포맷한다.
 * "2026-10-31T03:21:45.067428" → "2026. 10. 31. 03:21:45"
 */
export function formatAnalyzedAt(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!m) return value;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}. ${Number(mo)}. ${Number(d)}. ${h}:${mi}:${s}`;
}

const DETECTION_LABEL: Record<AnalysisResult["detectionLevel"], string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

/** 검출 신뢰도는 % 가 아니라 등급으로만 표시한다 */
export function detectionLabel(level: AnalysisResult["detectionLevel"]): string {
  return DETECTION_LABEL[level];
}

/** 검출 점수 7.92 (기준 5.0) */
export function detectionScore(z: number, threshold: number): string {
  return `검출 점수 ${z.toFixed(2)} (기준 ${threshold.toFixed(1)})`;
}

const RECIPIENT_LABEL: Record<RecipientType, string> = { EMPLOYEE: "직원", PARTNER: "협력사" };

export function recipientLabel(type: RecipientType): string {
  return RECIPIENT_LABEL[type];
}

/** "document.png" → "PNG", "a.jpg" → "JPEG" (서버 표기와 맞춘다) */
export function formatFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "png" ? "PNG" : "JPEG";
}
