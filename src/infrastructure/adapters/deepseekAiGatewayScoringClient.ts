import type { AiScoringClient, AiScoringRequest } from "../../usecases/scoring/scoringGateway";

export interface DeepSeekAiGatewayConfig {
  endpointUrl: string;
  apiKey?: string;
  model?: string;
  fetch?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const DEFAULT_MODEL = "deepseek-v4-flash";

export class DeepSeekAiGatewayScoringClient implements AiScoringClient {
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;

  constructor(private readonly config: DeepSeekAiGatewayConfig) {
    this.fetchImpl = config.fetch ?? fetch;
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async score(request: AiScoringRequest): Promise<unknown> {
    const response = await this.fetchImpl(this.config.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        messages: [
          {
            role: "system",
            content:
              "你是猜词游戏评分器。只返回 JSON 对象，字段包含 score、relation_type、is_exact、reason、confidence。",
          },
          {
            role: "user",
            content: JSON.stringify({
              answer: request.answer,
              guess: request.guess,
              language: request.language,
              scoring_rules_version: request.scoringRulesVersion,
              relation_caps: request.relationCaps,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return {};
    }

    return content;
  }
}
