import { describe, expect, it, vi } from "vitest";
import { DeepSeekAiGatewayScoringClient } from "./deepseekAiGatewayScoringClient";

describe("DeepSeekAiGatewayScoringClient", () => {
  it("omits authorization header when api key is empty", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] })
    })) as unknown as typeof fetch;
    const client = new DeepSeekAiGatewayScoringClient({
      endpointUrl: "https://example.com",
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
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});
