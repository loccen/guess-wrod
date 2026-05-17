import { describe, expect, it, vi } from "vitest";
import { DeepSeekAiGatewayScoringClient } from "./deepseekAiGatewayScoringClient";

describe("DeepSeekAiGatewayScoringClient", () => {
  it("api key 为空时不发送网关鉴权头，并自动补齐 chat completions 路径", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com/v1/acct/gateway/provider",
      fetch: fetchMock
    });
    await client.score({
      answer: "a",
      guess: "b",
      language: "zh-CN",
      scoringRulesVersion: "v1",
      relationCaps: { synonym: 20, same_category: 20 }
    });
    const url = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(url).toBe("https://example.com/v1/acct/gateway/provider/chat/completions");
    expect((init.headers as Record<string, string>)["cf-aig-authorization"]).toBeUndefined();
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
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

    await client.score({
      answer: "a",
      guess: "b",
      language: "zh-CN",
      scoringRulesVersion: "v1",
      relationCaps: { synonym: 20, same_category: 20 }
    });

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

    await client.score({
      answer: "a",
      guess: "b",
      language: "zh-CN",
      scoringRulesVersion: "v1",
      relationCaps: { synonym: 20, same_category: 20 }
    });

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["cf-aig-authorization"]).toBe("Bearer cf-token");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});
