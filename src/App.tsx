import { useCallback, useEffect, useState } from "react";
import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { ResultPage } from "./pages/ResultPage";
import { RulesPage } from "./pages/RulesPage";
import { SessionPage } from "./pages/SessionPage";
import { readRoute } from "./routes/routeState";

export default function App() {
  const [route, setRoute] = useState(() => readRoute(window.location));

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readRoute(window.location));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const nextUrl = new URL(to, window.location.origin);
    if (options?.replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
    setRoute(readRoute(window.location));
  }, []);

  if (route.page === "session") {
    return <SessionPage navigate={navigate} />;
  }

  if (route.page === "game") {
    return <GamePage route={route} navigate={navigate} />;
  }

  if (route.page === "result") {
    return <ResultPage route={route} navigate={navigate} />;
  }

  if (route.page === "rules") {
    return <RulesPage />;
  }

  return <HomePage navigate={navigate} />;
}
