import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisJob, InvestigationApi } from "./types";

export function useAnalysisJob(
  api: InvestigationApi,
  id: string,
  options: {
    onCompleted: (id: string) => void;
    onCancelled: () => void;
    intervalMs?: number;
  },
) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef(options);
  callbacks.current = options;
  const stop = useRef(() => {});
  const cancelRequest = useRef<AbortController | null>(null);
  const cancelBusy = useRef(false);
  const interval = options.intervalMs ?? 1000;

  useEffect(() => {
    let alive = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = new AbortController();
    setJob(null);
    setError(null);
    setLoading(true);
    const halt = () => {
      stopped = true;
      clearTimeout(timer);
      request.abort();
    };
    stop.current = halt;
    const poll = async () => {
      try {
        const value = await api.getAnalysis(id, request.signal);
        if (!alive || stopped || request.signal.aborted) return;
        if (value.id !== id)
          throw new Error(
            "다른 분석 작업의 응답입니다. 결과를 표시하지 않습니다.",
          );
        setJob(value);
        setLoading(false);
        if (value.status === "completed") {
          stopped = true;
          callbacks.current.onCompleted(id);
        } else if (value.status === "cancelled") {
          stopped = true;
          callbacks.current.onCancelled();
        } else if (value.status === "failed") {
          stopped = true;
          setError(value.error || "분석을 완료하지 못했습니다.");
        } else timer = setTimeout(poll, interval);
      } catch (reason) {
        if (!alive || stopped || request.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "분석 상태를 확인할 수 없습니다.",
        );
        setLoading(false);
      }
    };
    void poll();
    return () => {
      alive = false;
      halt();
      cancelRequest.current?.abort();
    };
  }, [api, id, attempt, interval]);

  const cancel = useCallback(async () => {
    if (cancelBusy.current) return;
    cancelBusy.current = true;
    stop.current(); // Ignore any late completion before starting DELETE.
    setCancelling(true);
    setError(null);
    const controller = new AbortController();
    cancelRequest.current = controller;
    try {
      await api.cancelAnalysis(id, controller.signal);
      if (!controller.signal.aborted) callbacks.current.onCancelled();
    } catch {
      if (!controller.signal.aborted)
        setError(
          "취소를 확인하지 못했습니다. 서버 작업은 진행 중일 수 있으니 상태를 다시 확인해 주세요.",
        );
    } finally {
      cancelBusy.current = false;
      if (!controller.signal.aborted) setCancelling(false);
    }
  }, [api, id]);
  const retry = useCallback(() => {
    if (!cancelBusy.current) setAttempt((n) => n + 1);
  }, []);
  return { job, error, loading, cancelling, cancel, retry };
}
