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
const GAME_BOOTSTRAP_TASK = "以下是这一局游戏的固定背景，请在整个多轮对话中保持一致理解，不要把其它游戏的信息混入当前对话。";
const TURN_TASK = "请根据固定背景和此前所有轮次，评估这一轮猜词与答案的接近程度。若历史里已经出现宽泛或误导方向，请主动纠偏，不要重复放大。";

export const SCORING_SYSTEM_PROMPT = [
  "你是中文猜词游戏的评分裁判。目标是给玩家提供真实有效的接近度信号，帮助缩小答案空间，而不是为任何弱关联找理由。",
  "",
  "你会收到：answer、answer_context、guess、guess_history、relation_caps。answer_context 只用于理解答案的核心类别、功能、部件、属性；guess_history 表示本局此前已经给过玩家的信号，你必须结合历史判断当前词是在纠偏还是在重复误导。",
  "",
  "输出要求：",
  "1. 只返回一个 JSON 对象，字段必须包含 score、relation_type、is_exact、reason、confidence。",
  "2. score 必须是 0 到 100 的整数。",
  "3. relation_type 只能从 exact、alias、synonym、parent_category、same_category、attribute、function、component、accessory、service_context、usage_context、weak_context、unrelated、invalid 中选择。",
  "4. 若 guess 不是标准答案或显式别名，不得判成 exact 或 alias。",
  "",
  "评分原则：",
  "1. 分数代表“是否真的帮助玩家逼近答案”，不是“能不能勉强扯上关系”。",
  "2. 只要一个词过于宽泛、抽象、泛化，无法明显缩小搜索范围，就必须低分。",
  "3. 即使存在弱关联，只要它容易把玩家继续带向错误方向，也不能高分。",
  "",
  "重点约束：",
  "1. parent_category 只适用于能明显收窄范围的稳定类别，如“电子产品”“办公用品”“时间工具”。",
  "2. “名词”“事物”“东西”“物品”“用品”这类超宽泛集合默认不是有效高分上位类。",
  "3. “每天会用的”“生活中常见的”“居家会用到”“日常会看到”这类泛场景描述通常只能算 weak_context，很多时候应是 unrelated，不得接近上限。",
  "4. “透明的”“红色的”“常见的”“便宜的”这类泛属性、弱属性、非核心属性，默认不能高分。",
  "5. 只有核心类别、核心功能、核心部件、强绑定用途或强区分属性，才值得中高分。",
  "",
  "历史纠偏规则：",
  "1. 先看历史高分词把玩家引向了什么方向。",
  "2. 如果历史高分主要是宽泛上位类、泛场景词、泛描述句，说明这条方向可能已经误导；当前同方向词必须更保守，不应继续升高。",
  "3. 如果当前词只是把历史里的模糊方向换个说法重复一次，不要因为换了措辞就继续高分。",
  "4. 只有当前词比历史词更具体、更接近答案核心信息时，才允许高于历史分数。",
  "",
  "可参考负面例子：若答案是“日历”，则“名词”“日用品”“每天会用的”都过于宽泛或泛场景，不应成为高价值高分线索；“时间工具”“日期”“月份”“查看日期”通常更有收敛价值。",
  "",
  "reason 要简短直接，明确说明高分来自核心类别/功能/部件/用途，或低分是因为词太宽泛、太抽象、太像重复误导方向。宁可保守，也不要误导。"
].join("\n");

function isExactRelation(relationType: string) {
  return relationType === "exact" || relationType === "alias";
}

function buildBootstrapMessage(request: AiScoringRequest) {
  return JSON.stringify({
    conversation_type: "guess_word_game",
    task: GAME_BOOTSTRAP_TASK,
    answer: request.answer,
    answer_context: request.answerContext,
    language: request.language,
    scoring_rules_version: request.scoringRulesVersion,
    relation_caps: request.relationCaps
  });
}

function buildTurnUserMessage(turn: number, guess: string) {
  return JSON.stringify({
    turn,
    guess,
    task: TURN_TASK
  });
}

function buildTurnAssistantMessage(entry: AiScoringRequest["guessHistory"]["guesses"][number]) {
  return JSON.stringify({
    score: entry.score,
    relation_type: entry.relationType,
    is_exact: isExactRelation(entry.relationType),
    reason: entry.reason ?? "历史回放：此前该轮评分结果已由业务侧记录。",
    confidence: null
  });
}

function buildMessages(request: AiScoringRequest) {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: SCORING_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: buildBootstrapMessage(request)
    }
  ];

  for (const entry of request.guessHistory.guesses) {
    messages.push({
      role: "user",
      content: buildTurnUserMessage(entry.order, entry.guess)
    });
    messages.push({
      role: "assistant",
      content: buildTurnAssistantMessage(entry)
    });
  }

  messages.push({
    role: "user",
    content: buildTurnUserMessage(request.guessHistory.totalPreviousGuesses + 1, request.guess)
  });

  return messages;
}

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
  private readonly fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private readonly model: string;
  private readonly requestUrl: string;

  constructor(private readonly config: DeepSeekAiGatewayConfig) {
    this.fetchImpl =
      config.fetch ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
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
          messages: buildMessages(request),
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
