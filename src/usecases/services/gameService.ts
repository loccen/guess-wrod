import { ApiError, DEFAULT_RULE_VERSION, GAME_TTL_MS } from "../../domain/models/api";
import type { Game, Guess, Word } from "../../domain/models/storage";
import { ObservabilityService } from "./observabilityService";
import type { AppServices } from "./platformPorts";
import type { AuthenticatedSession } from "./sessionService";
import { GameRuleService } from "./gameRuleService";

export interface CreateGameInput {
  mode?: string | null;
}

export interface CreateGameResult {
  gameId: string;
  mode: "random";
  status: Game["status"];
  guessCount: number;
  startedAt: string;
  expiresAt: string | null;
}

export interface GameStatusGuessSummary {
  guessId: string;
  guess: string;
  score: number | null;
  relationType: string | null;
  source: Guess["source"];
  counted: boolean;
  createdAt: string;
}

export interface GameStatusResult {
  gameId: string;
  status: Game["status"];
  guessCount: number;
  expireReason: Game["expireReason"];
  bestGuess: {
    guessId: string;
    guess: string;
    score: number | null;
  } | null;
  guesses: GameStatusGuessSummary[];
  startedAt: string;
  endedAt: string | null;
  answer?: string;
  answerAliases?: string[];
}

export interface GiveUpGameResult {
  gameId: string;
  status: "give_up";
  answer: string;
  guessCount: number;
  endedAt: string;
}

export interface ListGameHistoryInput {
  page?: number | null;
  pageSize?: number | null;
}

export interface GameHistoryItem {
  gameId: string;
  status: Exclude<Game["status"], "playing">;
  guessCount: number;
  startedAt: string;
  endedAt: string | null;
  expireReason: Game["expireReason"];
  bestGuess: {
    guessId: string;
    guess: string;
    score: number | null;
  } | null;
}

export interface ListGameHistoryResult {
  items: GameHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DeleteGameHistoryResult {
  success: true;
}

export interface ClearGameHistoryResult {
  success: true;
  deletedCount: number;
}

const HISTORY_STATUSES: Exclude<Game["status"], "playing">[] = ["success", "give_up", "expired"];
const DEFAULT_HISTORY_PAGE = 1;
const DEFAULT_HISTORY_PAGE_SIZE = 20;
const MAX_HISTORY_PAGE_SIZE = 50;

function plusMilliseconds(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

function toCreateGameResult(game: Game): CreateGameResult {
  return {
    gameId: game.id,
    mode: "random",
    status: game.status,
    guessCount: game.guessCount,
    startedAt: game.startedAt,
    expiresAt: game.expiresAt
  };
}

function durationMilliseconds(startedAt: string, endedAt: string): number {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

export class GameService {
  constructor(private readonly services: AppServices) {}

  async createGame(session: AuthenticatedSession, input: CreateGameInput): Promise<CreateGameResult> {
    const observability = new ObservabilityService(this.services);
    const gameRuleService = new GameRuleService(this.services);
    const mode = input.mode ?? "random";
    if (mode !== "random") {
      throw new ApiError({
        code: "invalid_request",
        status: 400,
        message: "当前只支持 random 模式。"
      });
    }

    const activeGames = await this.services.storage.games.listGamesByVisitor(session.visitorId, {
      status: "playing",
      limit: 1
    });
    const existingGame = activeGames[0];
    if (existingGame) {
      const resolvedGame = await gameRuleService.materializeExpiration(existingGame);
      if (resolvedGame.status === "playing") {
        return toCreateGameResult(resolvedGame);
      }
    }

    const words = await this.services.storage.words.listEnabledWords({ limit: 500 });
    if (words.length === 0) {
      throw new ApiError({
        code: "system_error",
        status: 500,
        message: "词库为空，无法创建游戏。"
      });
    }

    const randomIndex = Math.min(words.length - 1, Math.floor(this.services.randomSource.next() * words.length));
    const answer = words[randomIndex];
    const now = this.services.clock.now();
    const startedAt = now.toISOString();
    const expiresAt = plusMilliseconds(now, GAME_TTL_MS).toISOString();
    const game: Game = {
      id: this.services.idGenerator.next("game"),
      visitorId: session.visitorId,
      answerId: answer.id,
      status: "playing",
      ruleVersion: DEFAULT_RULE_VERSION,
      modelName: this.services.scoringProfile.modelName,
      thinkingMode: this.services.scoringProfile.thinkingMode,
      guessCount: 0,
      bestGuessId: null,
      startedAt,
      endedAt: null,
      expiresAt,
      expireReason: null
    };

    await this.services.storage.games.createGame(game);
    await observability.trackEvent({
      eventName: "game_created",
      eventTime: startedAt,
      visitorId: session.visitorId,
      sessionId: session.session.id,
      page: "game",
      gameId: game.id,
      answerId: game.answerId,
      modelName: game.modelName,
      ruleVersion: game.ruleVersion,
      payload: {
        mode,
        guess_count: game.guessCount
      }
    });
    return toCreateGameResult(game);
  }

  async getGameStatus(session: AuthenticatedSession, gameId: string): Promise<GameStatusResult> {
    const gameRuleService = new GameRuleService(this.services);
    const game = await gameRuleService.readOwnedGame(session.visitorId, gameId);
    const answer = await gameRuleService.readAnswerWord(game.answerId);
    const guesses = await this.services.storage.guesses.listGuessesByGame(game.id, { limit: 100 });
    const bestGuess = game.bestGuessId ? guesses.find((guess) => guess.id === game.bestGuessId) ?? null : null;

    const result: GameStatusResult = {
      gameId: game.id,
      status: game.status,
      guessCount: game.guessCount,
      expireReason: game.expireReason,
      bestGuess: bestGuess
        ? {
            guessId: bestGuess.id,
            guess: bestGuess.guessRaw,
            score: bestGuess.score
          }
        : null,
      guesses: guesses.map((guess) => ({
        guessId: guess.id,
        guess: guess.guessRaw,
        score: guess.score,
        relationType: guess.relationType,
        source: guess.source,
        counted: guess.counted,
        createdAt: guess.createdAt
      })),
      startedAt: game.startedAt,
      endedAt: game.endedAt
    };

    if (game.status !== "playing") {
      result.answer = answer.word;
      result.answerAliases = answer.aliases;
    }

    return result;
  }

  async giveUpGame(session: AuthenticatedSession, gameId: string): Promise<GiveUpGameResult> {
    const observability = new ObservabilityService(this.services);
    const gameRuleService = new GameRuleService(this.services);
    const game = await gameRuleService.readPlayableGame(session.visitorId, gameId);

    const nowIso = this.services.clock.now().toISOString();
    await this.services.storage.games.finishGame(game.id, "give_up", nowIso, null);
    const answer = await gameRuleService.readAnswerWord(game.answerId);
    const bestGuess = game.bestGuessId ? await this.services.storage.guesses.findGuessById(game.bestGuessId) : null;
    await observability.trackEvent({
      eventName: "game_give_up",
      eventTime: nowIso,
      visitorId: session.visitorId,
      sessionId: session.session.id,
      page: "result",
      gameId: game.id,
      answerId: game.answerId,
      modelName: game.modelName,
      ruleVersion: game.ruleVersion,
      payload: {
        guess_count: game.guessCount,
        duration_ms: durationMilliseconds(game.startedAt, nowIso),
        best_score: bestGuess?.score ?? null
      }
    });

    return {
      gameId: game.id,
      status: "give_up",
      answer: answer.word,
      guessCount: game.guessCount,
      endedAt: nowIso
    };
  }

  async listGameHistory(session: AuthenticatedSession, input: ListGameHistoryInput): Promise<ListGameHistoryResult> {
    const page = Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : DEFAULT_HISTORY_PAGE;
    const requestedPageSize =
      Number.isInteger(input.pageSize) && Number(input.pageSize) > 0 ? Number(input.pageSize) : DEFAULT_HISTORY_PAGE_SIZE;
    const pageSize = Math.min(MAX_HISTORY_PAGE_SIZE, requestedPageSize);
    const offset = (page - 1) * pageSize;

    const [games, total] = await Promise.all([
      this.services.storage.games.listGamesByVisitor(session.visitorId, {
        statuses: HISTORY_STATUSES,
        limit: pageSize,
        offset
      }),
      this.services.storage.games.countGamesByVisitor(session.visitorId, {
        statuses: HISTORY_STATUSES
      })
    ]);

    const bestGuessIds = Array.from(new Set(games.map((game) => game.bestGuessId).filter((value): value is string => Boolean(value))));
    const bestGuessEntries = await Promise.all(bestGuessIds.map((guessId) => this.services.storage.guesses.findGuessById(guessId)));
    const bestGuessMap = new Map(bestGuessEntries.filter((value): value is Guess => value !== null).map((guess) => [guess.id, guess]));

    return {
      items: games.map((game) => {
        const bestGuess = game.bestGuessId ? bestGuessMap.get(game.bestGuessId) ?? null : null;
        return {
          gameId: game.id,
          status: game.status as Exclude<Game["status"], "playing">,
          guessCount: game.guessCount,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          expireReason: game.expireReason,
          bestGuess: bestGuess
            ? {
                guessId: bestGuess.id,
                guess: bestGuess.guessRaw,
                score: bestGuess.score
              }
            : null
        };
      }),
      total,
      page,
      pageSize,
      hasMore: offset + games.length < total
    };
  }

  async deleteHistoryGame(session: AuthenticatedSession, gameId: string): Promise<DeleteGameHistoryResult> {
    const gameRuleService = new GameRuleService(this.services);
    const game = await gameRuleService.readOwnedGame(session.visitorId, gameId);
    if (game.status === "playing") {
      throw new ApiError({
        code: "invalid_request",
        status: 400,
        message: "进行中的游戏不能从历史记录中删除。"
      });
    }

    const deleted = await this.services.storage.games.deleteGameById(session.visitorId, gameId);
    if (!deleted) {
      throw new ApiError({
        code: "game_not_found",
        status: 404,
        message: "历史记录不存在。"
      });
    }

    return { success: true };
  }

  async clearGameHistory(session: AuthenticatedSession): Promise<ClearGameHistoryResult> {
    const deletedCount = await this.services.storage.games.deleteGamesByVisitor(session.visitorId, {
      statuses: HISTORY_STATUSES
    });
    return {
      success: true,
      deletedCount
    };
  }
}
