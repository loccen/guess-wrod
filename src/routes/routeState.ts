export type ResultMode = "success" | "give-up" | "expired";

export type RouteState =
  | { page: "home" }
  | { page: "session" }
  | { page: "game"; feedback: boolean }
  | { page: "rules" }
  | { page: "result"; mode: ResultMode };

export function readRoute(location: Location): RouteState {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(location.search);

  if (path === "/session") {
    return { page: "session" };
  }

  if (path === "/games/demo-playing") {
    return { page: "game", feedback: params.get("feedback") === "1" };
  }

  if (path === "/games/demo/result/success") {
    return { page: "result", mode: "success" };
  }

  if (path === "/games/demo/result/give-up") {
    return { page: "result", mode: "give-up" };
  }

  if (path === "/games/demo/result/expired") {
    return { page: "result", mode: "expired" };
  }

  if (path === "/rules") {
    return { page: "rules" };
  }

  return { page: "home" };
}
