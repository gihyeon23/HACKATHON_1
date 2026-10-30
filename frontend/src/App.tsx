import { useEffect, useState } from "react";
import AnalysisPending from "./pages/AnalysisPending";
import Landing from "./pages/Landing";
import Upload from "./pages/Upload";

const readRoute = () => window.location.hash.slice(1) || "/";

export default function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route === "/investigate") return <Upload onStarted={(id) => { window.location.hash = `/analyses/${id}`; }} />;
  if (route.startsWith("/analyses/")) return <AnalysisPending analysisId={decodeURIComponent(route.slice("/analyses/".length))} />;
  return <Landing />;
}
