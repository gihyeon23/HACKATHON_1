import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type TraceResult } from "./api";
import { Icon, Logo } from "./components/Ui";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Investigate from "./pages/Investigate";
import PathTrace from "./pages/PathTrace";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Viewer from "./pages/Viewer";

export const ACCOUNTS = [
  { id: "A", name: "김OO", org: "설계팀" },
  { id: "B", name: "박OO", org: "설계팀" },
  { id: "S", name: "보안팀", org: "관리자" },
];

const MENU = [
  { path: "/", label: "대시보드", icon: "home" },
  { path: "/docs", label: "문서 관리", icon: "doc" },
  { path: "/investigate", label: "유출 조사", icon: "search" },
  { path: "/trace", label: "경로 추적", icon: "route" },
  { path: "/report", label: "보고서", icon: "report" },
  { path: "/settings", label: "설정", icon: "gear" },
];

const useRoute = () => {
  const read = () => window.location.hash.slice(1) || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
};

export type Investigation = { file: Blob; name: string; result: TraceResult; tampered: boolean };

export default function App() {
  const route = useRoute();
  const [account, setAccount] = useState("A");
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [error, setError] = useState("");

  const analyze = useCallback(async (file: Blob, name: string, tampered = false) => {
    setError("");
    try {
      setInvestigation({ file, name, tampered, result: await api.trace(file) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "분석에 실패했습니다.");
    }
  }, []);

  if (route === "/viewer") return <Viewer />;

  return (
    <div className="shell">
      <aside className="side">
        <Logo />
        <nav aria-label="주 메뉴">
          {MENU.map((m) => (
            <a key={m.path} href={`#${m.path}`} className={route === m.path ? "nav-on" : ""} aria-current={route === m.path ? "page" : undefined}>
              <Icon name={m.icon} size={19} /> {m.label}
            </a>
          ))}
        </nav>
        <a href="#/viewer" className="side-viewer"><Icon name="eye" size={18} /> 보호 파일 뷰어</a>
        <p className="side-note">PoC · 샘플 데이터로 시연합니다</p>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="topbar-label">사내 계정</span>
          <div className="accounts" role="group" aria-label="사내 계정 선택">
            {ACCOUNTS.map((a) => (
              <button key={a.id} className={account === a.id ? "acc-on" : ""} aria-pressed={account === a.id} onClick={() => setAccount(a.id)}>
                <i className={`avatar avatar-${a.id}`}>{a.id}</i>{a.name}
              </button>
            ))}
          </div>
        </header>
        <main className="content">
          {route === "/" && <Dashboard />}
          {route === "/docs" && <Documents account={account} />}
          {route === "/investigate" && <Investigate current={investigation} error={error} onFile={analyze} onClear={() => setInvestigation(null)} />}
          {route === "/trace" && <PathTrace />}
          {route === "/report" && <Report current={investigation} />}
          {route === "/settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}
