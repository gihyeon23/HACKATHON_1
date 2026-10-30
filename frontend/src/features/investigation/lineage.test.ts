import { describe, expect, it } from "vitest";
import { makeDemoPath } from "./fixtures";
import { formatScore, safeImageUrl, verifyPath } from "./lineage";

describe("registered parent relationships", () => {
  it.each([3, 5, 7])(
    "orders %i nodes by parents instead of array position",
    (length) => {
      const path = makeDemoPath(length);
      const expected = path.nodes.map((node) => node.copyCode);
      path.nodes.reverse();
      expect(verifyPath(path)).toMatchObject({
        status: "complete",
        nodes: expected.map((copyCode) => ({ copyCode })),
      });
    },
  );
  it("shows only the connected suffix when a parent is missing", () => {
    const verified = verifyPath(makeDemoPath(5, "missing_parent"));
    expect(verified.status).toBe("partial");
    expect(verified.nodes).toHaveLength(2);
    expect(verified.nodes[0].copyCode).toBe("COPY-B103");
    expect(verified.reasons.join()).toContain("누락");
  });
  it("rejects cycles and duplicates without drawing a chain", () => {
    expect(verifyPath(makeDemoPath(3, "cycle"))).toMatchObject({
      status: "invalid",
      nodes: [],
    });
    const path = makeDemoPath(3);
    path.nodes.push(path.nodes[0]);
    expect(verifyPath(path)).toMatchObject({ status: "invalid", nodes: [] });
  });
  it("does not label the wrong root or incomplete server evidence as complete", () => {
    const path = makeDemoPath(3);
    path.documentCode = "OTHER";
    expect(verifyPath(path).status).toBe("partial");
    path.documentCode = "DOC-A001";
    path.complete = false;
    expect(verifyPath(path).status).toBe("partial");
  });
  it("distinguishes empty paths and missing identified copies", () => {
    expect(verifyPath(makeDemoPath(3, "empty_path")).status).toBe("empty");
    const path = makeDemoPath(3);
    path.nodes.pop();
    expect(verifyPath(path).status).toBe("invalid");
  });
});

it("renders raw correlation as a score and only calibrated probability as percent", () => {
  expect(
    formatScore({ value: 0.987, kind: "correlation", calibrated: false }).value,
  ).toBe("0.987");
  expect(
    formatScore({ value: 0.987, kind: "probability", calibrated: false }).value,
  ).toBe("0.987");
  expect(
    formatScore({ value: 0.987, kind: "probability", calibrated: true }).value,
  ).toBe("98.7%");
});
it("rejects executable and remote cleartext preview URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.example/img",
    "http://evil.example/img",
  ])
    expect(safeImageUrl(url)).toBeUndefined();
  expect(safeImageUrl("/api/images/1")).toBe("/api/images/1");
});
