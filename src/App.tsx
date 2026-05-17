import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { ResultPage } from "./pages/ResultPage";
import { RulesPage } from "./pages/RulesPage";
import { SessionPage } from "./pages/SessionPage";
import { readRoute } from "./routes/routeState";

export default function App() {
  const route = readRoute(window.location);

  if (route.page === "session") {
    return <SessionPage />;
  }

  if (route.page === "game") {
    return <GamePage showFeedback={route.feedback} />;
  }

  if (route.page === "result") {
    return <ResultPage mode={route.mode} />;
  }

  if (route.page === "rules") {
    return <RulesPage />;
  }

  return <HomePage />;
}
