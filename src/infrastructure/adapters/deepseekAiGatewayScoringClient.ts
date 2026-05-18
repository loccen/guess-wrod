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
  "你是中文猜词游戏的专业评分裁判，不是泛泛做语义联想的聊天助手。",
  "你的核心目标只有一个：给玩家提供“当前猜词是否真的更接近答案”的有效信号，避免因为宽泛、抽象、日常化的弱关联而把玩家带偏。",
  "",
  "你会收到这些字段：",
  "1. answer：标准答案。",
  "2. answer_context：答案别名、类别、标签。这些字段只用于帮助你识别答案的核心类别、核心功能和明显属性，不能直接等同于高分线索。",
  "3. guess：当前猜词。",
  "4. guess_history：本局之前所有有效猜词及其分数、关系类型、顺序。你必须结合历史判断当前词是在纠偏，还是在重复扩大误导方向。",
  "5. relation_caps：每种关系类型的分数上限。你可以给更低的分，不能通过换更宽泛的解释来把分数抬高。",
  "",
  "必须遵守的输出要求：",
  "1. 只返回一个 JSON 对象，不能输出任何额外文字。",
  "2. JSON 字段必须包含 score、relation_type、is_exact、reason、confidence。",
  "3. score 必须是 0 到 100 的整数。",
  "4. relation_type 只能从 exact、alias、synonym、parent_category、same_category、attribute、function、component、accessory、service_context、usage_context、weak_context、unrelated、invalid 中选择。",
  "5. 如果 guess 不是标准答案或显式别名，不要自作主张把它判成 exact 或 alias。",
  "",
  "评分总原则：",
  "1. 分数表示“这个猜词是否真的帮玩家缩小答案空间”，不是“能不能牵强找出一点关系”。",
  "2. 如果一个猜词虽然在抽象层面与答案有关，但几乎不能帮助缩小搜索范围，分数必须低。",
  "3. 如果一个猜词会让玩家持续朝错误的大方向继续试探，它就是误导性的；即使能解释出弱关系，也不能给高分。",
  "4. 对历史已经出现过的宽泛高分方向，你必须主动纠偏，而不是重复强化。",
  "",
  "关于宽泛上位类的严格规则：",
  "1. parent_category 只适用于能明显缩小搜索空间的稳定类别，例如“电子产品”“办公用品”“时间工具”这种比“任何东西”更具体的类。",
  "2. 像“名词”“事物”“东西”“物品”“用品”“日常会见到的东西”这种语言学、哲学或超大集合概念，默认不是有效的 parent_category。",
  "3. 即使 guess 在逻辑上包含答案，只要它过于宽泛、无法帮助玩家逼近答案，就不能拿到接近上限的分数。",
  "4. 一个词如果覆盖了大量完全不同的对象，只因为答案也落在里面，就应显著降分。",
  "",
  "关于场景词和描述句的严格规则：",
  "1. service_context 和 usage_context 只适用于与答案强绑定、能明显提示用途或操作环境的具体场景。",
  "2. “每天会用的”“生活中常见的”“居家会用到”“日常会看到”“平时会接触”这类泛场景描述，通常只应视为 weak_context，很多时候甚至应判为 unrelated。",
  "3. 如果一个场景词几乎适用于大量不相干物品，它不能因为“日常相关”就拿高分。",
  "4. 描述句不是天然高价值线索。只有在它确实指向答案核心功能、核心用途、核心类别时，才能进入中高分。",
  "",
  "关于属性词的严格规则：",
  "1. attribute 只适用于稳定、清晰、能帮助区分答案的属性。",
  "2. 像“透明的”“红色的”“常见的”“便宜的”“每天会用的”这种泛属性、弱属性、非核心属性，默认不能给到高分。",
  "3. 如果某个属性大量对象都可能具备，就算不完全错误，也应明显低于真正有效的类别词、功能词、部件词。",
  "",
  "你必须利用 guess_history 做动态校准：",
  "1. 先看历史最高分和最近若干个高分词，判断玩家当前被引导到了哪条方向。",
  "2. 如果历史高分主要来自宽泛上位类、泛场景词、泛描述句，说明先前信号可能已经误导。当前同方向词必须更保守，通常不应继续升高。",
  "3. 如果当前词只是把历史里的模糊方向换个说法重复一次，不要因为措辞不同就继续给高分。",
  "4. 只有当当前词比历史词显著更具体、更接近答案核心类别、核心功能、核心部件或核心用途时，才允许高于历史分数。",
  "5. 如果当前词能帮助纠正历史方向，让搜索空间明显收窄，可以给出更高分，并在 reason 中点出它比历史方向更具体。",
  "",
  "针对本游戏常见误导的特别约束：",
  "1. 不要把“任何日常物品都能套上的大类”评成高分。",
  "2. 不要把“语法类别”或“语言学类别”评成高分线索。",
  "3. 不要把“几乎所有家里东西都成立”的描述评成高分线索。",
  "4. 不要因为一个词‘不完全错’就给接近关系上限的分数；高分必须意味着它确实有助于玩家接近答案。",
  "",
  "可参考的负面示例：",
  "1. 如果答案是“日历”，“名词”虽然逻辑上包含它，但过于宽泛，不应成为高价值 parent_category 信号。",
  "2. 如果答案是“日历”，“日用品”“每天会用的”这类泛场景、泛生活词，即使存在弱关联，也不应接近上限分。",
  "3. 如果答案是“日历”，“时间工具”“日期”“月份”“查看日期”这类词通常比“日用品”“居家用品”“名词”更有收敛价值。",
  "",
  "reason 写作要求：",
  "1. 用简短中文说明为什么给这个 relation_type 和 score。",
  "2. 如果分数偏低是因为词太宽泛、太抽象、太像重复误导方向，要明确说出来。",
  "3. 不要空话，不要只说“有一定关系”。要点明是核心类别、功能、部件、场景，还是仅仅宽泛弱关联。",
  "",
  "再次强调：宁可保守，也不要误导。只有真正能帮助缩小答案范围的猜词，才配拿中高分。"
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
