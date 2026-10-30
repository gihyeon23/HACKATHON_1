import type { AnalysisResult, CopyPath, InvestigationFile } from "./types";

export type DemoScenario =
  | "identified"
  | "not_detected"
  | "unlinked"
  | "failed"
  | "missing_parent"
  | "cycle"
  | "empty_path"
  | "path_error";
export const demoFile: InvestigationFile = {
  id: "DEMO-FILE",
  name: "OLED_설계도.png",
  sizeBytes: 2516582,
  width: 1920,
  height: 1080,
  mimeType: "image/png",
  imageUrl: "/mock/blueprint.png",
};

/** UI fixtures only. IDs, names, dimensions and scores are illustrative. */
export function makeDemoPath(
  length: number,
  scenario: DemoScenario = "identified",
): CopyPath {
  const nodes: CopyPath["nodes"] = [
    {
      copyCode: "DOC-A001",
      parentCopyCode: null,
      name: "OLED 설계도",
      kind: "document",
    },
  ];
  for (let index = 1; index < length; index++) {
    nodes.push({
      copyCode: index === length - 1 ? "COPY-C203" : `COPY-B${100 + index}`,
      parentCopyCode: nodes[index - 1].copyCode,
      name:
        index === length - 1
          ? "협력사 C"
          : index === 1
            ? "직원 B"
            : `중간 배포 사본 ${index}`,
      kind: index === length - 1 ? "partner" : "employee",
    });
  }
  if (scenario === "cycle")
    nodes[0].parentCopyCode = nodes[nodes.length - 1].copyCode;
  if (scenario === "missing_parent")
    nodes.splice(Math.max(1, Math.floor(length / 2)), 1);
  return {
    identifiedCopyCode: "COPY-C203",
    documentCode: "DOC-A001",
    nodes: scenario === "empty_path" ? [] : nodes,
    complete: scenario !== "missing_parent",
    unverifiedSegments: [],
  };
}

export function makeDemoResult(
  id: string,
  length: number,
  scenario: DemoScenario = "identified",
): AnalysisResult {
  const status = ["not_detected", "unlinked", "failed"].includes(scenario)
    ? (scenario as AnalysisResult["status"])
    : "identified";
  return {
    analysisId: id,
    status,
    file: demoFile,
    copyCode:
      status === "not_detected" || status === "failed" ? null : "COPY-C203",
    document:
      status === "identified"
        ? {
            code: "DOC-A001",
            title: "OLED 설계도",
            imageUrl: "/mock/blueprint.png",
          }
        : null,
    score:
      status === "identified" || status === "unlinked"
        ? {
            value: 0.987,
            kind: "correlation",
            calibrated: false,
            threshold: 0.12,
          }
        : null,
    analyzedAt: "2026-10-30T18:00:00Z",
    method: "주파수 영역 검출 · DEMO 예시",
    distributionSteps: status === "identified" ? length : null,
    summary:
      status === "identified"
        ? [
            "이미지에서 사본 식별 정보를 검출한 예시입니다.",
            "식별된 사본 ID가 등록된 배포 기록과 연결된 예시입니다.",
            "해당 사본의 등록된 부모 관계를 확인할 수 있습니다.",
          ]
        : status === "not_detected"
          ? [
              "식별할 수 있는 패턴을 찾지 못한 예시입니다.",
              "이미지 품질이나 변형 때문에 검출되지 않았을 수도 있습니다.",
            ]
          : status === "unlinked"
            ? [
                "검출 단서가 있으나 등록된 원본·사본 관계를 찾지 못한 예시입니다.",
              ]
            : ["분석 서버가 처리 오류를 반환한 예시입니다."],
    error:
      status === "failed"
        ? "DEMO: 이미지 처리 중 오류가 발생했습니다."
        : undefined,
  };
}
