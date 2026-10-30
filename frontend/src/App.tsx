import { useEffect, useState } from "react";
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

  if (route === "/investigate") return <Upload />;
  return <Landing />;
}
