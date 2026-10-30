import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useAnalysisJob } from "./useAnalysisJob";
import { demoFile } from "./fixtures";
import type { AnalysisJob, InvestigationApi } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const completed: AnalysisJob = {
  id: "a",
  status: "completed",
  phase: "lineage",
  progress: 100,
  elapsedSeconds: 5,
  file: demoFile,
};
function stub(overrides: Partial<InvestigationApi>): InvestigationApi {
  return {
    mode: "api",
    getAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    getResult: vi.fn(),
    getPath: vi.fn(),
    ...overrides,
  };
}
it("ignores completion arriving after cancellation even if the transport ignores abort", async () => {
  const pending = deferred<AnalysisJob>();
  const getAnalysis = vi.fn().mockReturnValue(pending.promise);
  const onCompleted = vi.fn(),
    onCancelled = vi.fn();
  const api = stub({
    getAnalysis,
    cancelAnalysis: vi.fn().mockResolvedValue(undefined),
  });
  const { result } = renderHook(() =>
    useAnalysisJob(api, "a", { onCompleted, onCancelled }),
  );
  await act(async () => {
    await result.current.cancel();
  });
  await act(async () => {
    pending.resolve(completed);
  });
  expect(getAnalysis.mock.calls[0][1].aborted).toBe(true);
  expect(onCompleted).not.toHaveBeenCalled();
  expect(onCancelled).toHaveBeenCalledTimes(1);
});
it("aborts polling on unmount and does not navigate on a late response", async () => {
  const pending = deferred<AnalysisJob>(),
    getAnalysis = vi.fn().mockReturnValue(pending.promise),
    onCompleted = vi.fn();
  const api = stub({ getAnalysis });
  const { unmount } = renderHook(() =>
    useAnalysisJob(api, "a", { onCompleted, onCancelled: vi.fn() }),
  );
  unmount();
  await act(async () => {
    pending.resolve(completed);
  });
  expect(getAnalysis.mock.calls[0][1].aborted).toBe(true);
  expect(onCompleted).not.toHaveBeenCalled();
});
it("stops at failed jobs instead of converting failures to successful results", async () => {
  const onCompleted = vi.fn();
  const getAnalysis = vi
    .fn()
    .mockResolvedValue({
      ...completed,
      status: "failed",
      error: "engine failed",
    });
  const api = stub({ getAnalysis });
  const { result } = renderHook(() =>
    useAnalysisJob(api, "a", {
      onCompleted,
      onCancelled: vi.fn(),
      intervalMs: 10,
    }),
  );
  await waitFor(() => expect(result.current.error).toBe("engine failed"));
  expect(getAnalysis).toHaveBeenCalledTimes(1);
  expect(onCompleted).not.toHaveBeenCalled();
});
it("does not claim cancellation succeeded when DELETE fails", async () => {
  const onCancelled = vi.fn(),
    pending = deferred<AnalysisJob>();
  const api = stub({
    getAnalysis: () => pending.promise,
    cancelAnalysis: vi.fn().mockRejectedValue(new Error("offline")),
  });
  const { result } = renderHook(() =>
    useAnalysisJob(api, "a", { onCompleted: vi.fn(), onCancelled }),
  );
  await act(async () => {
    await result.current.cancel();
  });
  expect(result.current.error).toContain("서버 작업은 진행 중");
  expect(onCancelled).not.toHaveBeenCalled();
});
