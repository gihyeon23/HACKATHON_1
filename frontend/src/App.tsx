import { useEffect, useRef, useState } from "react";
import type { CopyIssued, UploadedFile } from "./api/types";
import { CopyIssuedPage } from "./pages/CopyIssuedPage";
import { CopyIssuePage } from "./pages/CopyIssuePage";
import { DocumentRegisterPage, type RegisteredDoc } from "./pages/DocumentRegisterPage";
import { HckViewerPage } from "./pages/HckViewerPage";
import { LandingPage } from "./pages/LandingPage";
import { PathPreviewPage } from "./pages/PathPreviewPage";
import { ProgressPage } from "./pages/ProgressPage";
import { ResultPage } from "./pages/ResultPage";
import { UploadPage } from "./pages/UploadPage";

type Screen =
  | { name: "landing" }
  // 유출 조사
  | { name: "upload"; notice?: string }
  | { name: "progress"; analysisId: string; file: UploadedFile }
  | { name: "result"; analysisId: string }
  // 배포본 발급
  | { name: "docRegister" }
  // from: 발급 완료 화면에서 "사본 하나 더 발급"으로 왔으면 이전 버튼이 그 화면으로 돌아간다
  | { name: "copyIssue"; doc: RegisteredDoc; from?: CopyIssued }
  | { name: "copyIssued"; doc: RegisteredDoc; copy: CopyIssued }
  // 보호 파일(.hck) 뷰어 — 받은 사람이 바로 열 수 있게 #viewer 주소로도 들어온다
  | { name: "viewer" };

// 개발 서버에서만: ?pathPreview=COPY-G407 로 실제 경로 API 결과를 모달로 띄워 5 · 7단계를 확인한다
const pathPreviewCode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("pathPreview") : null;

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    window.location.hash === "#viewer" ? { name: "viewer" } : { name: "landing" },
  );
  const docUrlRef = useRef<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    // 발급 흐름을 벗어나면 원본 미리보기용 blob URL 을 해제한다
    const url = "doc" in screen ? screen.doc.previewUrl : null;
    if (docUrlRef.current && docUrlRef.current !== url) URL.revokeObjectURL(docUrlRef.current);
    docUrlRef.current = url;
  }, [screen]);

  if (pathPreviewCode) return <PathPreviewPage copyCode={pathPreviewCode} />;

  const toUpload = (notice?: string) => setScreen({ name: "upload", notice });
  const toIssue = () => setScreen({ name: "docRegister" });
  const toLanding = () => setScreen({ name: "landing" });

  switch (screen.name) {
    case "landing":
      return <LandingPage onStart={() => toUpload()} onIssue={toIssue} onOpenHck={() => setScreen({ name: "viewer" })} />;
    case "upload":
      return (
        <UploadPage
          notice={screen.notice}
          onStarted={(analysisId, file) => setScreen({ name: "progress", analysisId, file })}
          onIssue={toIssue}
          onBack={toLanding}
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
    case "docRegister":
      return <DocumentRegisterPage onRegistered={(doc) => setScreen({ name: "copyIssue", doc })} onBack={toLanding} />;
    case "copyIssue":
      return (
        <CopyIssuePage
          doc={screen.doc}
          onIssued={(copy) => setScreen({ name: "copyIssued", doc: screen.doc, copy })}
          onBack={() => (screen.from ? setScreen({ name: "copyIssued", doc: screen.doc, copy: screen.from }) : toLanding())}
        />
      );
    case "copyIssued":
      return (
        <CopyIssuedPage
          doc={screen.doc}
          copy={screen.copy}
          onIssueAnother={() => setScreen({ name: "copyIssue", doc: screen.doc, from: screen.copy })}
          onAnalyze={() => toUpload()}
          onBack={toLanding}
        />
      );
    case "viewer":
      return (
        <HckViewerPage
          onHome={() => {
            if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
            setScreen({ name: "landing" });
          }}
        />
      );
  }
}
