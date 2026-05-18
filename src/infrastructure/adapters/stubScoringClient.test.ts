import { describe, expect, it } from "vitest";
import { StubScoringClient } from "./stubScoringClient";

describe("StubScoringClient", () => {
  it("returns configured structured responses by normalized guess", async () => {
    const client = new StubScoringClient([
      {
        guess: "维修",
        response: { score: 72, relation_type: "service_context", confidence: 0.8 },
      },
    ]);

    await expect(
      client.score({
        answer: "手机",
        answerContext: {
          aliases: [],
          categories: [],
          tags: [],
        },
        guess: "维修",
        guessHistory: {
          totalPreviousGuesses: 0,
          bestScore: null,
          bestGuess: null,
          guesses: [],
        },
        language: "zh-CN",
        scoringRulesVersion: "v0.2",
        relationCaps: {},
      }),
    ).resolves.toEqual({ score: 72, relation_type: "service_context", confidence: 0.8 });
  });

  it("uses unrelated as the default local stub response", async () => {
    const client = new StubScoringClient();

    await expect(
      client.score({
        answer: "手机",
        answerContext: {
          aliases: [],
          categories: [],
          tags: [],
        },
        guess: "石头",
        guessHistory: {
          totalPreviousGuesses: 0,
          bestScore: null,
          bestGuess: null,
          guesses: [],
        },
        language: "zh-CN",
        scoringRulesVersion: "v0.2",
        relationCaps: {},
      }),
    ).resolves.toMatchObject({
      score: 18,
      relation_type: "unrelated",
      is_exact: false,
    });
  });
});
