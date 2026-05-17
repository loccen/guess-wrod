import type { AiScoringClient, AiScoringRequest } from "../../usecases/scoring/scoringGateway";

export interface DeepSeekAiGatewayConfig {
  endpointUrl: string;
  apiKey?: string;
  byokAlias?: string;
  model?: string;
  fetch?: typeof fetch;
}

export interface AiGatewayRequestDiagnostic {
  responseStatus: number | null;
  requestUrl: string;
  requestPath: string;
  responseSummaryPrefix: string | null;
  hasGatewayAuth: boolean;
  hasByokAlias: boolean;
}

export class AiGatewayRequestError extends Error {
  constructor(message: string, readonly diagnostic: AiGatewayRequestDiagnostic) {
    super(message);
    this.name = "AiGatewayRequestError";
  }
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const DEFAULT_MODEL = "deepseek-v4-flash";
const RESPONSE_SUMMARY_PREFIX_MAX_LENGTH = 200;

function resolveChatCompletionsUrl(endpointUrl: string): string {
  const OPENAI_CHAT_COMPLETIONS_PATH = "/chat/completions";
  const normalizedEndpoint = endpointUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(normalizedEndpoint);
  } catch {
    return normalizedEndpoint;
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  if (!path.endsWith(OPENAI_CHAT_COMPLETIONS_PATH)) {
    parsed.pathname = `${path}${OPENAI_CHAT_COMPLETIONS_PATH}`;
  }

  return parsed.toString();
}

export class DeepSeekAiGatewayScoringClient implements AiScoringClient {
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;
  private readonly requestUrl: string;

  constructor(private readonly config: DeepSeekAiGatewayConfig) {
    this.fetchImpl = config.fetch ?? fetch;
    this.model = config.model ?? DEFAULT_MODEL;
    this.requestUrl = resolveChatCompletionsUrl(config.endpointUrl);
  }

  async score(request: AiScoringRequest): Promise<unknown> {
    const hasGatewayAuth = Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
    const hasByokAlias = Boolean(this.config.byokAlias && this.config.byokAlias.trim().length > 0);
    let response: Response;
    try {
      response = await this.fetchImpl(this.requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(hasGatewayAuth ? { "cf-aig-authorization": `Bearer ${this.config.apiKey}` } : {}),
          ...(hasByokAlias ? { "cf-aig-byok-alias": this.config.byokAlias } : {}),
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
    } catch (error) {
      throw new AiGatewayRequestError("AI Gateway request failed before response.", {
        responseStatus: null,
        requestUrl: this.requestUrl,
        requestPath: toPath(this.requestUrl),
        responseSummaryPrefix: toMessage(error),
        hasGatewayAuth,
        hasByokAlias,
      });
    }

    if (!response.ok) {
      throw new AiGatewayRequestError(`AI Gateway request failed with status ${response.status}.`, {
        responseStatus: response.status,
        requestUrl: this.requestUrl,
        requestPath: toPath(this.requestUrl),
        responseSummaryPrefix: await summarizeResponse(response),
        hasGatewayAuth,
        hasByokAlias,
      });
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return {};
    }

    return content;
  }
}

function toPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

async function summarizeResponse(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    const compact = text.trim().replace(/\s+/g, " ");
    if (compact.length === 0) {
      return null;
    }
    return compact.slice(0, RESPONSE_SUMMARY_PREFIX_MAX_LENGTH);
  } catch {
    return null;
  }
}

function toMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, RESPONSE_SUMMARY_PREFIX_MAX_LENGTH);
  }
  return null;
}
