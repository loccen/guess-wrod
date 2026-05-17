import { describe, expect, it } from "vitest";
import { formatDurationText, formatExpiresText, getErrorMessage, mapRelationLabel, toGuessHistoryItems, toGuessSubmitNotice } from "./frontendFlow";
import { buildFeedbackNote, validateFeedbackNote } from "./feedbackFlow";
import { FrontendApiError } from "./apiClient";
import { buildGamePath, buildResultPath, readRoute, toResultMode } from "../routes/routeState";

describe("routeState", () => {
  it("parses real game and result routes", () => {
    const gameRoute = readRoute(new URL("https://example.com/games/game_42?feedback=guess_9") as unknown as Location);
    const resultRoute = readRoute(new URL("https://example.com/games/game_42/result/give-up") as unknown as Location);

    expect(gameRoute).toEqual({ page: "game", feedback: true, feedbackGuessId: "guess_9", gameId: "game_42", demo: false });
    expect(resultRoute).toEqual({ page: "result", gameId: "game_42", mode: "give-up", demo: false });
  });

  it("builds game and result paths", () => {
    expect(buildGamePath("game_1")).toBe("/games/game_1");
    expect(buildResultPath("game_1", "expired")).toBe("/games/game_1/result/expired");
    expect(readRoute(new URL("https://example.com/games/demo-playing?feedback=1") as unknown as Location)).toEqual({
      page: "game",
      feedback: true,
      feedbackGuessId: null,
      gameId: null,
      demo: true
    });
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
        guessId: "guess_1",
        rank: 1,
        word: "平板",
        score: 76,
        relation: "同类",
        counted: true,
        feedbackHref: "/feedback/guess_1"
      }
    ]);
  });

  it("disables feedback links for non-counted guesses", () => {
    const guesses = toGuessHistoryItems(
      [
        {
          guess_id: "guess_2",
          guess: "平板",
          score: 76,
          relation_type: "same_category",
          source: "game_cache",
          counted: false,
          created_at: "2026-05-18T00:00:00.000Z"
        }
      ],
      (guessId) => `/feedback/${guessId}`
    );

    expect(guesses[0]).toMatchObject({
      guessId: "guess_2",
      counted: false,
      feedbackHref: null
    });
  });

  it("formats remaining time text", () => {
    const text = formatExpiresText(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    expect(text).toMatch(/^剩余 /);
  });

  it("maps submit notice for counted and duplicate guesses", () => {
    expect(
      toGuessSubmitNotice({
        guess_id: "guess_1",
        guess: "电器",
        normalized_guess: "电器",
        score: 66,
        relation_type: "parent_category",
        is_exact: false,
        status: "playing",
        source: "model",
        counted: true,
        guess_count: 1,
        best_guess: null
      })
    ).toEqual({
      tone: "success",
      text: "已提交 “电器”，关系 上位，分数 66%。"
    });

    expect(
      toGuessSubmitNotice({
        guess_id: "guess_1",
        guess: "电器",
        normalized_guess: "电器",
        score: 66,
        relation_type: "parent_category",
        is_exact: false,
        status: "playing",
        source: "game_cache",
        counted: false,
        guess_count: 1,
        best_guess: null
      })
    ).toEqual({
      tone: "warning",
      text: "“电器” 已猜过，不计次，当前关系 上位，分数 66%。"
    });
  });

  it("maps frontend api errors into user facing text", () => {
    const invalidGuessError = new FrontendApiError(400, {
      error: {
        code: "invalid_guess",
        message: "猜词不能为空。",
        counted: false
      }
    });

    expect(getErrorMessage(invalidGuessError)).toBe("请输入 1 到 20 个字符的有效猜词。");
  });

  it("builds feedback note payloads for unsupported directions", () => {
    expect(buildFeedbackNote("score-high", "这个分数高了")).toBe("这个分数高了");
    expect(buildFeedbackNote("score-low", "")).toBe("反馈方向：分数偏低");
    expect(buildFeedbackNote("relation-wrong", "更像配件")).toBe("反馈方向：关系不对；更像配件");
  });

  it("validates feedback note length", () => {
    expect(validateFeedbackNote("score-high", "a".repeat(100))).toBeNull();
    expect(validateFeedbackNote("score-high", "a".repeat(101))).toBe("补充说明最多 100 个字。");
  });
});
