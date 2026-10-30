import type { CopyNode, CopyPath, DetectionScore } from "./types";

export interface VerifiedPath {
  status: "complete" | "partial" | "invalid" | "empty";
  nodes: CopyNode[];
  reasons: string[];
}

/** Follow parent IDs, independent of server array order. Never invent a node. */
export function verifyPath(path: CopyPath): VerifiedPath {
  if (!path.nodes.length)
    return {
      status: "empty",
      nodes: [],
      reasons: ["등록된 배포 관계가 없습니다."],
    };
  const lookup = new Map<string, CopyNode>();
  for (const node of path.nodes) {
    if (lookup.has(node.copyCode))
      return {
        status: "invalid",
        nodes: [],
        reasons: ["중복된 사본 ID가 있어 경로를 확정할 수 없습니다."],
      };
    lookup.set(node.copyCode, node);
  }
  const leaf = lookup.get(path.identifiedCopyCode);
  if (!leaf)
    return {
      status: "invalid",
      nodes: [],
      reasons: ["식별된 사본의 등록 정보를 찾지 못했습니다."],
    };
  const visited = new Set<string>();
  const reversed: CopyNode[] = [];
  let current: CopyNode | undefined = leaf;
  const reasons = [...path.unverifiedSegments];
  let reachedRoot = false;
  while (current) {
    if (visited.has(current.copyCode))
      return {
        status: "invalid",
        nodes: [],
        reasons: ["부모 관계가 순환합니다. 경로를 표시하지 않습니다."],
      };
    visited.add(current.copyCode);
    reversed.push(current);
    if (current.parentCopyCode === null) {
      reachedRoot =
        current.copyCode === path.documentCode && current.kind === "document";
      if (!reachedRoot)
        reasons.push("최초 원본 문서까지의 연결을 확인하지 못했습니다.");
      break;
    }
    const next = lookup.get(current.parentCopyCode);
    if (!next) {
      reasons.push(
        `부모 사본 ${current.parentCopyCode}의 기록이 누락되었습니다.`,
      );
      break;
    }
    current = next;
  }
  if (!path.complete && !reasons.length)
    reasons.push("서버가 이 배포 기록을 불완전한 경로로 응답했습니다.");
  return {
    status:
      reachedRoot && path.complete && !reasons.length ? "complete" : "partial",
    nodes: reversed.reverse(),
    reasons,
  };
}

export function formatScore(score: DetectionScore | null): {
  label: string;
  value: string;
  note: string;
} {
  if (!score || !Number.isFinite(score.value))
    return { label: "검출 점수", value: "제공되지 않음", note: "" };
  if (
    score.kind === "probability" &&
    score.calibrated &&
    score.value >= 0 &&
    score.value <= 1
  ) {
    return {
      label: "검출 확률",
      value: `${(score.value * 100).toFixed(1)}%`,
      note: "API가 보정된 확률로 제공한 값입니다.",
    };
  }
  return {
    label:
      score.kind === "zscore"
        ? "검출 z-score"
        : score.kind === "correlation"
          ? "검출 상관 점수"
          : "검출 점수",
    value: score.value.toFixed(3),
    note: "확률이 아닌 점수입니다. 이 값만으로 실제 유출자를 확정하지 않습니다.",
  };
}

export function safeImageUrl(value?: string): string | undefined {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return url.href;
  } catch {
    /* Invalid or unsafe URLs are displayed as an image-unavailable state. */
  }
  return undefined;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(1)}MB`
    : `${Math.max(0, Math.round(bytes / 1024))}KB`;
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
