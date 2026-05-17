import { describe, expect, it } from "vitest";
import { formatDurationText, formatExpiresText, mapRelationLabel, toGuessHistoryItems } from "./frontendFlow";
import { buildGamePath, buildResultPath, readRoute, toResultMode } from "../routes/routeState";

describe("routeState", () => {
  it("parses real game and result routes", () => {
    const gameRoute = readRoute(new URL("https://example.com/games/game_42?feedback=1") as unknown as Location);
    const resultRoute = readRoute(new URL("https://example.com/games/game_42/result/give-up") as unknown as Location);

    expect(gameRoute).toEqual({ page: "game", feedback: true, gameId: "game_42", demo: false });
    expect(resultRoute).toEqual({ page: "result", gameId: "game_42", mode: "give-up", demo: false });
  });

  it("builds game and result paths", () => {
    expect(buildGamePath("game_1")).toBe("/games/game_1");
    expect(buildResultPath("game_1", "expired")).toBe("/games/game_1/result/expired");
  });
});

describe("frontendFlow helpers", () => {
  it("maps backend status to result route mode", () => {
    expect(toResultMode("success")).toBe("success");
    expect(toResultMode("give_up")).toBe("give-up");
    expect(toResultMode("expired")).toBe("expired");
    expect(toResultMode("playing")).toBeNull();
  });

  it("formats durations and relation labels", () => {
    expect(formatDurationText("2026-05-18T00:00:00.000Z", "2026-05-18T00:06:18.000Z")).toBe("6分18秒");
    expect(mapRelationLabel("same_category")).toBe("同类");
    expect(mapRelationLabel("service_context")).toBe("场景");
  });

  it("maps guesses into history items", () => {
    const guesses = toGuessHistoryItems(
      [
        {
          guess_id: "guess_1",
          guess: "平板",
          score: 76,
          relation_type: "same_category",
          source: "model",
          counted: true,
          created_at: "2026-05-18T00:00:00.000Z"
        }
      ],
      (guessId) => `/feedback/${guessId}`
    );

    expect(guesses).toEqual([
      {
        rank: 1,
        word: "平板",
        score: 76,
        relation: "同类",
        feedbackHref: "/feedback/guess_1"
      }
    ]);
  });

  it("formats remaining time text", () => {
    const text = formatExpiresText(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    expect(text).toMatch(/^剩余 /);
  });
});
