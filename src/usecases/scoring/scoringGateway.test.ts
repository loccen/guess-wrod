import { describe, expect, it } from "vitest";
import { SCORING_ERROR_CODES } from "../../domain/scoring/index.mjs";
import { ScoringGateway, shouldRetryAiScoringError, type AiScoringClient, type AiScoringRequest } from "./scoringGateway";

class QueueScoringClient implements AiScoringClient {
  requests: AiScoringRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  async score(request: AiScoringRequest): Promise<unknown> {
    this.requests.push(request);
    return this.responses.shift();
  }
}

describe("ScoringGateway", () => {
  it("returns local exact matches without calling AI", async () => {
    const client = new QueueScoringClient([]);
    const gateway = new ScoringGateway(client);

    const result = await gateway.score({
      answer: "手机",
      aliases: ["智能手机"],
      guess: "智能手机",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      score: 100,
      relationType: "alias",
      source: "exact_match",
      attempts: 0,
    });
    expect(client.requests).toHaveLength(0);
  });

  it("returns structured stub AI scores", async () => {
    const client = new QueueScoringClient([{ score: 72, relation_type: "service_context", confidence: 0.86 }]);
    const gateway = new ScoringGateway(client);

    const result = await gateway.score({
      answer: "手机",
      guess: "维修",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      score: 72,
      relationType: "service_context",
      source: "ai",
      attempts: 1,
      guessNormalized: "维修",
    });
    expect(client.requests[0]).toMatchObject({
      answer: "手机",
      answerContext: {
        aliases: [],
        categories: [],
        tags: [],
      },
      guess: "维修",
      language: "zh-CN",
      scoringRulesVersion: "v0.2",
      guessHistory: {
        totalPreviousGuesses: 0,
        bestScore: null,
        bestGuess: null,
        guesses: [],
      },
    });
  });

  it("passes answer metadata and guess history into AI requests", async () => {
    const client = new QueueScoringClient([{ score: 60, relation_type: "function" }]);
    const gateway = new ScoringGateway(client);

    await gateway.score({
      answer: "日历",
      aliases: ["挂历"],
      answerCategories: ["办公用品", "时间工具"],
      answerTags: ["日期", "月份"],
      guess: "查看日期",
      guessHistory: {
        totalPreviousGuesses: 2,
        bestScore: 75,
        bestGuess: "日用品",
        guesses: [
          { order: 1, guess: "日用品", score: 75, relationType: "usage_context", source: "model" },
          { order: 2, guess: "每天会用的", score: 78, relationType: "service_context", source: "model" },
        ],
      },
    });

    expect(client.requests[0]).toMatchObject({
      answerContext: {
        aliases: ["挂历"],
        categories: ["办公用品", "时间工具"],
        tags: ["日期", "月份"],
      },
      guessHistory: {
        totalPreviousGuesses: 2,
        bestScore: 75,
        bestGuess: "日用品",
        guesses: [
          { order: 1, guess: "日用品", score: 75, relationType: "usage_context", source: "model" },
          { order: 2, guess: "每天会用的", score: 78, relationType: "service_context", source: "model" },
        ],
      },
    });
  });

  it("retries invalid JSON and succeeds on the second AI output", async () => {
    const client = new QueueScoringClient(["not-json", { score: 83, relation_type: "same_category" }]);
    const gateway = new ScoringGateway(client, { maxAttempts: 2 });

    const result = await gateway.score({
      answer: "手机",
      guess: "平板",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.attempts).toBe(2);
    expect(client.requests).toHaveLength(2);
  });

  it("fails invalid relation type after configured retries", async () => {
    const client = new QueueScoringClient([
      { score: 60, relation_type: "nearby" },
      { score: 60, relation_type: "nearby" },
    ]);
    const gateway = new ScoringGateway(client, { maxAttempts: 2 });

    const result = await gateway.score({
      answer: "手机",
      guess: "电话",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatchObject({
      code: SCORING_ERROR_CODES.INVALID_RELATION_TYPE,
      attempts: 2,
      source: "ai",
    });
  });

  it("applies score bounds and relation caps after AI output", async () => {
    const client = new QueueScoringClient([{ score: 999, relation_type: "weak_context", confidence: 1.2 }]);
    const gateway = new ScoringGateway(client);

    const result = await gateway.score({
      answer: "手机",
      guess: "旅游",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.score).toBe(55);
    expect(result.ok && result.value.ai?.wasRuleAdjusted).toBe(true);
    expect(result.ok && result.value.ai?.adjustments.map((item) => item.type)).toEqual(["score_bounds", "relation_cap"]);
  });

  it("fails after retry when AI claims exact without local match", async () => {
    const client = new QueueScoringClient([
      { score: 100, relation_type: "exact", is_exact: true },
      { score: 100, relation_type: "alias", is_exact: true },
    ]);
    const gateway = new ScoringGateway(client, { maxAttempts: 2 });

    const result = await gateway.score({
      answer: "手机",
      aliases: ["智能手机"],
      guess: "电话",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatchObject({
      code: SCORING_ERROR_CODES.AI_EXACT_WITHOUT_LOCAL_MATCH,
      attempts: 2,
      source: "ai",
    });
    expect(client.requests).toHaveLength(2);
  });

  it("does not retry non-retryable validation errors", async () => {
    const client = new QueueScoringClient([]);
    const gateway = new ScoringGateway(client, { maxAttempts: 2 });

    const result = await gateway.score({
      answer: "手机",
      guess: "",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatchObject({
      code: SCORING_ERROR_CODES.EMPTY_INPUT,
      attempts: 0,
      source: "validation",
      retryable: false,
    });
    expect(client.requests).toHaveLength(0);
  });

  it("exposes retry decisions for post-processing errors", () => {
    expect(shouldRetryAiScoringError({ code: SCORING_ERROR_CODES.INVALID_JSON, retryable: true })).toBe(true);
    expect(shouldRetryAiScoringError({ code: SCORING_ERROR_CODES.INVALID_RELATION_TYPE, retryable: true })).toBe(true);
    expect(shouldRetryAiScoringError({ code: SCORING_ERROR_CODES.AI_EXACT_WITHOUT_LOCAL_MATCH, retryable: true })).toBe(true);
    expect(shouldRetryAiScoringError({ code: SCORING_ERROR_CODES.EMPTY_INPUT, retryable: false })).toBe(false);
  });
});
