import { expect, it, vi } from "vitest";
import {
  createInvestigationApi,
  parseJob,
  parsePath,
  parseResult,
} from "./api";
import { demoFile, makeDemoPath, makeDemoResult } from "./fixtures";

it("validates nullable fields, statuses, dimensions and scores at the API boundary", () => {
  expect(() => parseResult(makeDemoResult("a", 3))).not.toThrow();
  expect(() =>
    parseResult({ ...makeDemoResult("a", 3), score: { value: "0.98" } }),
  ).toThrow();
  expect(() =>
    parseResult({
      ...makeDemoResult("a", 3),
      status: "identified",
      copyCode: null,
    }),
  ).toThrow();
  expect(() =>
    parseJob({
      id: "a",
      file: demoFile,
      status: "running",
      phase: "watermark",
      progress: 101,
      elapsedSeconds: 2,
    }),
  ).toThrow();
  expect(() =>
    parsePath({
      ...makeDemoPath(3),
      nodes: [{ copyCode: "x", parentCopyCode: 42 }],
    }),
  ).toThrow();
});
it("routes encoded IDs through the same-origin Java gateway and passes abort signal", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(makeDemoPath(3))));
  const signal = new AbortController().signal;
  await createInvestigationApi(fetcher).getPath("COPY/a b", signal);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/copies/COPY%2Fa%20b/path",
    expect.objectContaining({ signal, credentials: "same-origin" }),
  );
});
it("accepts empty cancellation responses and surfaces server errors", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "작업을 찾지 못했습니다." }), {
        status: 404,
      }),
    );
  const api = createInvestigationApi(fetcher),
    signal = new AbortController().signal;
  await expect(api.cancelAnalysis("a", signal)).resolves.toBeUndefined();
  await expect(api.getResult("a", signal)).rejects.toThrow(
    "작업을 찾지 못했습니다.",
  );
});
