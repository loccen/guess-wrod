export type ResultMode = "success" | "give-up" | "expired";

export type RouteState =
  | { page: "home" }
  | { page: "session" }
  | { page: "game"; feedback: boolean; gameId: string | null; demo: boolean }
  | { page: "rules" }
  | { page: "result"; mode: ResultMode; gameId: string | null; demo: boolean };

const GAME_PLAYING_PATH = /^\/games\/([^/]+)$/;
const GAME_RESULT_PATH = /^\/games\/([^/]+)\/result\/(success|give-up|expired)$/;

export function readRoute(location: Location): RouteState {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(location.search);

  if (path === "/session") {
    return { page: "session" };
  }

  if (path === "/games/demo-playing") {
    return { page: "game", feedback: params.get("feedback") === "1", gameId: null, demo: true };
  }

  if (path === "/games/demo/result/success") {
    return { page: "result", mode: "success", gameId: null, demo: true };
  }

  if (path === "/games/demo/result/give-up") {
    return { page: "result", mode: "give-up", gameId: null, demo: true };
  }

  if (path === "/games/demo/result/expired") {
    return { page: "result", mode: "expired", gameId: null, demo: true };
  }

  const gameMatch = path.match(GAME_PLAYING_PATH);
  if (gameMatch) {
    return {
      page: "game",
      feedback: params.get("feedback") === "1",
      gameId: decodeURIComponent(gameMatch[1]),
      demo: false
    };
  }

  const resultMatch = path.match(GAME_RESULT_PATH);
  if (resultMatch) {
    return {
      page: "result",
      gameId: decodeURIComponent(resultMatch[1]),
      mode: resultMatch[2] as ResultMode,
      demo: false
    };
  }

  if (path === "/rules") {
    return { page: "rules" };
  }

  return { page: "home" };
}

export function buildGamePath(gameId: string): string {
  return `/games/${encodeURIComponent(gameId)}`;
}

export function buildGameFeedbackPath(gameId: string): string {
  return `${buildGamePath(gameId)}?feedback=1`;
}

export function buildResultPath(gameId: string, mode: ResultMode): string {
  return `/games/${encodeURIComponent(gameId)}/result/${mode}`;
}

export function toResultMode(status: string): ResultMode | null {
  if (status === "success") {
    return "success";
  }

  if (status === "give_up") {
    return "give-up";
  }

  if (status === "expired") {
    return "expired";
  }

  return null;
}
