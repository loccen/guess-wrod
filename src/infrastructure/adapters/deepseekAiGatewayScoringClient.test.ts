import { describe, expect, it, vi } from "vitest";
import { DeepSeekAiGatewayScoringClient, SCORING_SYSTEM_PROMPT } from "./deepseekAiGatewayScoringClient";

function buildAiRequest(overrides: Partial<Parameters<DeepSeekAiGatewayScoringClient["score"]>[0]> = {}) {
  return {
    answer: "a",
    answerContext: {
      aliases: [],
      categories: [],
      tags: []
    },
    guess: "b",
    guessHistory: {
      totalPreviousGuesses: 0,
      bestScore: null,
      bestGuess: null,
      guesses: []
    },
    language: "zh-CN",
    scoringRulesVersion: "v0.2",
    relationCaps: { synonym: 20, same_category: 20 },
    ...overrides
  };
}

describe("DeepSeekAiGatewayScoringClient", () => {
  it("未显式注入 fetch 时，使用 runtime fetch 的正确 this 绑定", async () => {
    const originalFetch = globalThis.fetch;
    const guardedFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation: function called with incorrect this reference.");
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "{}" } }] })
      } as Response);
    });
    globalThis.fetch = guardedFetch as unknown as typeof fetch;

    try {
      const client = new DeepSeekAiGatewayScoringClient({
        endpointUrl: "https://example.com/v1/acct/gateway/provider"
      });
      await client.score(buildAiRequest());
      expect(guardedFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("api key 为空时不发送网关鉴权头，并自动补齐 chat completions 路径", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      fetch: fetchMock
    });
    await client.score(buildAiRequest());
    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(url).toBe("https://example.com/v1/acct/gateway/provider/chat/completions");
    expect((init.headers as Record<string, string>)["cf-aig-authorization"]).toBeUndefined();
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    const payload = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.messages[0]?.content).toBe(SCORING_SYSTEM_PROMPT);
    expect(payload.messages[1]?.role).toBe("user");
    expect(JSON.parse(payload.messages[1]?.content ?? "{}")).toMatchObject({
      conversation_type: "guess_word_game",
      answer: "a",
      answer_context: {
        aliases: [],
        categories: [],
        tags: []
      },
      scoring_rules_version: "v0.2"
    });
  });

  it("endpoint 已包含 chat completions 后缀时保持不变", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider/chat/completions",
      fetch: fetchMock
    });

    await client.score(buildAiRequest());

    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe("https://example.com/v1/acct/gateway/provider/chat/completions");
  });

  it("api key 非空时使用 cf-aig-authorization，而不是 provider Authorization", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      apiKey: "cf-token",
      fetch: fetchMock
    });

    await client.score(buildAiRequest());

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["cf-aig-authorization"]).toBe("Bearer cf-token");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("配置 BYOK alias 时发送 cf-aig-byok-alias 头", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      byokAlias: "guess-word",
      fetch: fetchMock
    });

    await client.score(buildAiRequest());

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["cf-aig-byok-alias"]).toBe("guess-word");
  });

  it("BYOK alias 为空时不发送 cf-aig-byok-alias 头", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      byokAlias: "",
      fetch: fetchMock
    });

    await client.score(buildAiRequest());

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["cf-aig-byok-alias"]).toBeUndefined();
  });

  it("请求体包含答案上下文与完整猜词历史", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      fetch: fetchMock
    });

    await client.score(
      buildAiRequest({
        answer: "日历",
        answerContext: {
          aliases: ["挂历"],
          categories: ["办公用品", "时间工具"],
          tags: ["日期", "月份"]
        },
        guess: "每天会用的",
        guessHistory: {
          totalPreviousGuesses: 2,
          bestScore: 75,
          bestGuess: "日用品",
          guesses: [
            { order: 1, guess: "日用品", score: 75, relationType: "usage_context", source: "model" },
            { order: 2, guess: "名词", score: 80, relationType: "parent_category", source: "model" }
          ]
        }
      })
    );

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(JSON.parse(payload.messages[1]?.content ?? "{}")).toMatchObject({
      conversation_type: "guess_word_game",
      answer: "日历",
      answer_context: {
        aliases: ["挂历"],
        categories: ["办公用品", "时间工具"],
        tags: ["日期", "月份"]
      },
      scoring_rules_version: "v0.2"
    });
    expect(payload.messages.slice(2)).toEqual([
      {
        role: "user",
        content: JSON.stringify({
          turn: 1,
          guess: "日用品",
          task: "请根据固定背景和此前所有轮次，评估这一轮猜词与答案的接近程度。若历史里已经出现宽泛或误导方向，请主动纠偏，不要重复放大。"
        })
      },
      {
        role: "assistant",
        content: JSON.stringify({
          score: 75,
          relation_type: "usage_context",
          is_exact: false,
          reason: "历史回放：此前该轮评分结果已由业务侧记录。",
          confidence: null
        })
      },
      {
        role: "user",
        content: JSON.stringify({
          turn: 2,
          guess: "名词",
          task: "请根据固定背景和此前所有轮次，评估这一轮猜词与答案的接近程度。若历史里已经出现宽泛或误导方向，请主动纠偏，不要重复放大。"
        })
      },
      {
        role: "assistant",
        content: JSON.stringify({
          score: 80,
          relation_type: "parent_category",
          is_exact: false,
          reason: "历史回放：此前该轮评分结果已由业务侧记录。",
          confidence: null
        })
      },
      {
        role: "user",
        content: JSON.stringify({
          turn: 3,
          guess: "每天会用的",
          task: "请根据固定背景和此前所有轮次，评估这一轮猜词与答案的接近程度。若历史里已经出现宽泛或误导方向，请主动纠偏，不要重复放大。"
        })
      }
    ]);
  });

  it("网关返回非 2xx 时抛出带最小诊断信息的错误", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "Authentication Fails (governor)"
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/custom-guessword-deepseek",
      apiKey: "cf-token",
      byokAlias: "guess-word",
      fetch: fetchMock
    });

    await expect(
      client.score({
        ...buildAiRequest()
      })
    ).rejects.toMatchObject({
      name: "AiGatewayRequestError",
      diagnostic: {
        responseStatus: 401,
        requestUrl: "https://example.com/v1/acct/custom-guessword-deepseek/chat/completions",
        requestPath: "/v1/acct/custom-guessword-deepseek/chat/completions",
        responseSummaryPrefix: "Authentication Fails (governor)",
        hasGatewayAuth: true,
        hasByokAlias: true
      }
    });
  });
});
