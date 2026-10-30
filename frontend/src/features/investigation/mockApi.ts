import type { AnalysisJob, InvestigationApi } from "./types";
import {
  demoFile,
  makeDemoPath,
  makeDemoResult,
  type DemoScenario,
} from "./fixtures";

function delay(signal: AbortSignal, ms = 240): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function createMockApi(
  length = 3,
  scenario: DemoScenario = "identified",
): InvestigationApi {
  let calls = 0;
  let cancelled = false;
  const updates = [
    {
      phase: "validation",
      progress: 18,
      status: "running",
      elapsedSeconds: 1,
      phaseElapsedSeconds: 1,
      message: "파일 형식과 이미지 정보를 확인하고 있습니다.",
    },
    {
      phase: "watermark",
      progress: 68,
      status: "running",
      elapsedSeconds: 3,
      phaseElapsedSeconds: 2,
      message: "샘플의 식별 정보를 확인하고 있습니다.",
    },
    {
      phase: "lineage",
      progress: 92,
      status: "running",
      elapsedSeconds: 5,
      phaseElapsedSeconds: 1,
      message: "등록된 사본과 부모 관계를 조회하고 있습니다.",
    },
    {
      phase: "lineage",
      progress: 100,
      status: "completed",
      elapsedSeconds: 6,
      phaseElapsedSeconds: 2,
    },
  ] as const;
  return {
    mode: "mock",
    async getAnalysis(id, signal) {
      await delay(signal);
      const update = updates[Math.min(calls++, updates.length - 1)];
      return {
        ...update,
        id,
        file: demoFile,
        status: cancelled ? "cancelled" : update.status,
      } as AnalysisJob;
    },
    async cancelAnalysis(_id, signal) {
      await delay(signal);
      cancelled = true;
    },
    async getResult(id, signal) {
      await delay(signal);
      return makeDemoResult(id, length, scenario);
    },
    async getPath(_copy, signal) {
      await delay(signal);
      if (scenario === "path_error")
        throw new Error("DEMO: 배포 경로 서버가 응답하지 않습니다.");
      return makeDemoPath(length, scenario);
    },
  };
}
