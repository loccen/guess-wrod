import { apiClient, FrontendApiError, type GameStatusData, type SessionData, type SubmitGuessData } from "./apiClient";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./sessionTokenStore";
import type { ResultMode } from "../routes/routeState";

export type RestoredSession = {
  token: string;
  session: SessionData;
  recreated: boolean;
};

export type GuessHistoryItem = {
  guessId: string;
  rank: number;
  word: string;
  score: number;
  relation: string;
  counted: boolean;
  feedbackHref: string | null;
};

export type GamePageModel = {
  gameId: string;
  countText: string;
  expiresText: string;
  bestGuessWord: string;
  bestGuessScore: number;
  guesses: GuessHistoryItem[];
};

export type ResultPageModel = {
  answer: string;
  aliasesText: string;
  statAValue: string;
  statBValue: string;
  statCValue: string;
  guesses: GuessHistoryItem[];
};

export type GuessSubmitNotice = {
  tone: "success" | "warning";
  text: string;
};

const GAME_MAX_GUESSES = 100;
const GAME_TTL_MS = 24 * 60 * 60 * 1000;

export function isFrontendApiError(error: unknown): error is FrontendApiError {
  return error instanceof FrontendApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof FrontendApiError) {
    if (error.code === "unauthorized") {
      return "会话已失效，正在重新建立匿名会话。";
    }
    if (error.code === "game_not_found") {
      return "这局游戏不存在，或不属于当前匿名会话。";
    }
    if (error.code === "game_ended") {
      return "这局已经结束，正在刷新结果。";
    }
    if (error.code === "invalid_guess") {
      return "请输入 1 到 20 个字符的有效猜词。";
    }
    if (error.code === "sensitive_word") {
      return "猜词包含敏感内容，请换一个词。";
    }
    if (error.code === "rate_limited") {
      return "提交太快了，请稍后再试。";
    }
    if (error.code === "ai_timeout") {
      return "评分超时了，请重试这次猜词。";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败，请稍后重试。";
}

function getClientTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

async function createFreshSession(): Promise<RestoredSession> {
  const created = await apiClient.createSession({
    clientTimezone: getClientTimezone()
  });
  writeSessionToken(created.session_token);

  return {
    token: created.session_token,
    recreated: true,
    session: {
      visitor_id: created.visitor_id,
      expires_at: created.expires_at,
      active_game_id: null
    }
  };
}

export async function ensureSession(): Promise<RestoredSession> {
  const token = readSessionToken();
  if (!token) {
    return createFreshSession();
  }

  try {
    return {
      token,
      session: await apiClient.getSession(token),
      recreated: false
    };
  } catch (error) {
    if (isFrontendApiError(error) && error.code === "unauthorized") {
      clearSessionToken();
      return createFreshSession();
    }
    throw error;
  }
}

export async function requireSessionToken(): Promise<string> {
  const restored = await ensureSession();
  return restored.token;
}

export function formatExpiresText(startedAt: string): string {
  const expiresAt = new Date(new Date(startedAt).getTime() + GAME_TTL_MS);
  const remainingMs = expiresAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    return "已超过 24 小时";
  }

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingHours >= 24) {
    return "剩余 24 小时";
  }

  if (remainingHours >= 1) {
    return `剩余 ${remainingHours} 小时`;
  }

  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  return `剩余 ${remainingMinutes} 分钟`;
}

export function formatDurationText(startedAt: string, endedAt: string | null): string {
  if (!endedAt) {
    return "进行中";
  }

  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}时${minutes}分`;
  }

  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }

  return `${seconds}秒`;
}

export function mapRelationLabel(relationType: string | null): string {
  switch (relationType) {
    case "exact":
      return "命中";
    case "alias":
      return "别名";
    case "synonym":
      return "近义";
    case "parent_category":
      return "上位";
    case "same_category":
      return "同类";
    case "attribute":
      return "属性";
    case "function":
      return "功能";
    case "component":
      return "部件";
    case "accessory":
      return "配件";
    case "service_context":
    case "usage_context":
      return "场景";
    case "weak_context":
      return "弱相关";
    case "unrelated":
      return "无关";
    default:
      return "待定";
  }
}

export function toGuessHistoryItems(
  guesses: GameStatusData["guesses"],
  feedbackHrefBuilder: (guessId: string) => string
): GuessHistoryItem[] {
  return guesses.map((guess, index) => ({
    guessId: guess.guess_id,
    rank: index + 1,
    word: guess.guess,
    score: guess.score ?? 0,
    relation: mapRelationLabel(guess.relation_type),
    counted: guess.counted,
    feedbackHref: guess.counted && guess.score !== null ? feedbackHrefBuilder(guess.guess_id) : null
  }));
}

export function toGamePageModel(game: GameStatusData, feedbackHrefBuilder: (guessId: string) => string): GamePageModel {
  const guesses = toGuessHistoryItems(game.guesses, feedbackHrefBuilder);

  return {
    gameId: game.game_id,
    countText: `第 ${game.guess_count} 次 / ${GAME_MAX_GUESSES}`,
    expiresText: formatExpiresText(game.started_at),
    bestGuessWord: game.best_guess?.guess ?? "还没有",
    bestGuessScore: game.best_guess?.score ?? 0,
    guesses
  };
}

export function toGuessSubmitNotice(result: SubmitGuessData): GuessSubmitNotice {
  const relationLabel = mapRelationLabel(result.relation_type);
  if (!result.counted) {
    return {
      tone: "warning",
      text: `“${result.guess}” 已猜过，不计次，当前关系 ${relationLabel}，分数 ${result.score}%。`
    };
  }

  if (result.status === "success") {
    return {
      tone: "success",
      text: `“${result.guess}” 猜中了，答案已揭晓。`
    };
  }

  return {
    tone: "success",
    text: `已提交 “${result.guess}”，关系 ${relationLabel}，分数 ${result.score}%。`
  };
}

export function toResultPageModel(mode: ResultMode, game: GameStatusData): ResultPageModel {
  const sortedGuesses = [...game.guesses].sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const reviewGuesses = (mode === "success" ? sortedGuesses.filter((guess) => (guess.score ?? 0) < 100) : sortedGuesses).slice(0, 3);

  return {
    answer: game.answer ?? "未知",
    aliasesText: game.answer_aliases?.length ? `也接受：${game.answer_aliases.join(" / ")}` : "暂无别名",
    statAValue: `${game.guess_count}次`,
    statBValue: mode === "success" ? formatDurationText(game.started_at, game.ended_at) : `${game.best_guess?.score ?? 0}%`,
    statCValue: mode === "success" ? `${game.best_guess?.score ?? 0}%` : mode === "give-up" ? "放弃" : "过期",
    guesses: toGuessHistoryItems(reviewGuesses, () => "#")
  };
}
