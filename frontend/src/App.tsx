import { useEffect, useState } from "react";
import type { UploadedFile } from "./api/types";
import { LandingPage } from "./pages/LandingPage";
import { PathPreviewPage } from "./pages/PathPreviewPage";
import { ProgressPage } from "./pages/ProgressPage";
import { ResultPage } from "./pages/ResultPage";
import { UploadPage } from "./pages/UploadPage";

type Screen =
  | { name: "landing" }
  | { name: "upload"; notice?: string }
  | { name: "progress"; analysisId: string; file: UploadedFile }
  | { name: "result"; analysisId: string };

// 개발 서버에서만: ?pathPreview=COPY-G407 로 실제 경로 API 결과를 모달로 띄워 5 · 7단계를 확인한다
const pathPreviewCode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("pathPreview") : null;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "landing" });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  if (pathPreviewCode) return <PathPreviewPage copyCode={pathPreviewCode} />;

  const toUpload = (notice?: string) => setScreen({ name: "upload", notice });

  switch (screen.name) {
    case "landing":
      return <LandingPage onStart={() => toUpload()} />;
    case "upload":
      return (
        <UploadPage
          notice={screen.notice}
          onStarted={(analysisId, file) => setScreen({ name: "progress", analysisId, file })}
        />
      );
    case "progress":
      return (
        <ProgressPage
          analysisId={screen.analysisId}
          file={screen.file}
          onCompleted={() => setScreen({ name: "result", analysisId: screen.analysisId })}
          onExit={toUpload}
        />
      );
    case "result":
      return <ResultPage analysisId={screen.analysisId} onRestart={toUpload} />;
  }
}
