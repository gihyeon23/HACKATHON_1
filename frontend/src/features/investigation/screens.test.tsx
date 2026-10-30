import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AnalysisResultPage } from "./AnalysisResultPage";
import { DistributionPathModal } from "./DistributionPathModal";
import { makeDemoPath, makeDemoResult } from "./fixtures";
import type { InvestigationApi } from "./types";

function stub(length = 3): InvestigationApi {
  return {
    mode: "mock",
    getAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    getResult: vi.fn().mockResolvedValue(makeDemoResult("a", length)),
    getPath: vi.fn().mockResolvedValue(makeDemoPath(length)),
  };
}
it.each([3, 5, 7])(
  "renders %i read-only path nodes with only the identified node highlighted",
  async (length) => {
    const { container } = render(
      <DistributionPathModal
        api={stub(length)}
        copyCode="COPY-C203"
        filename="plan.png"
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(length),
    );
    expect(document.querySelectorAll(".path-node-identified")).toHaveLength(1);
    expect(within(dialog).getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector("[role=dialog]")).toBeNull(); // rendered as portal
  },
);
it("keeps the result behind the modal and restores focus and body scroll on Escape", async () => {
  const user = userEvent.setup();
  render(<AnalysisResultPage api={stub()} analysisId="a" onUpload={vi.fn()} />);
  const opener = await screen.findByRole("button", {
    name: /배포 경로 확인하기/,
  });
  await user.click(opener);
  const close = screen.getByRole("button", { name: "배포 경로 닫기" });
  expect(document.activeElement).toBe(close);
  expect(document.body.style.overflow).toBe("hidden");
  expect(
    screen.getByRole("heading", { name: "문서 사본을 식별했습니다." }),
  ).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe("");
});
it("prevents Tab from leaving the dialog", async () => {
  render(
    <DistributionPathModal
      api={stub()}
      copyCode="COPY-C203"
      filename="plan.png"
      onClose={vi.fn()}
    />,
  );
  const list = screen
    .getByRole("region", { name: "배포 계보" })
    .querySelector<HTMLElement>(".path-scroll")!;
  list.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "배포 경로 닫기" }),
  );
});
it("disables unavailable original and path actions for an undetected image", async () => {
  const api = stub();
  api.getResult = vi
    .fn()
    .mockResolvedValue(makeDemoResult("a", 3, "not_detected"));
  render(<AnalysisResultPage api={api} analysisId="a" onUpload={vi.fn()} />);
  await screen.findByRole("heading", {
    name: "식별 가능한 패턴을 찾지 못했습니다.",
  });
  expect(
    (screen.getByRole("button", { name: /원본 보기/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: /배포 경로 확인하기/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
