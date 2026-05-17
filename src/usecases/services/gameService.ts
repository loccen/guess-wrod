import { ApiError, DEFAULT_RULE_VERSION, GAME_TTL_MS } from "../../domain/models/api";
import type { Game, Guess, Word } from "../../domain/models/storage";
import type { AppServices } from "./platformPorts";
import type { AuthenticatedSession } from "./sessionService";

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

export class GameService {
  constructor(private readonly services: AppServices) {}

  async createGame(session: AuthenticatedSession, input: CreateGameInput): Promise<CreateGameResult> {
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
      return toCreateGameResult(existingGame);
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
    return toCreateGameResult(game);
  }

  async getGameStatus(session: AuthenticatedSession, gameId: string): Promise<GameStatusResult> {
    const game = await this.readOwnedGame(session.visitorId, gameId);
    const answer = await this.readAnswerWord(game.answerId);
    const guesses = await this.services.storage.guesses.listGuessesByGame(game.id, { limit: 100 });
    const bestGuess = game.bestGuessId ? guesses.find((guess) => guess.id === game.bestGuessId) ?? null : null;

    const result: GameStatusResult = {
      gameId: game.id,
      status: game.status,
      guessCount: game.guessCount,
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
    const game = await this.readOwnedGame(session.visitorId, gameId);
    if (game.status !== "playing") {
      throw new ApiError({
        code: "game_ended",
        status: 409,
        message: "当前游戏已结束。"
      });
    }

    const nowIso = this.services.clock.now().toISOString();
    await this.services.storage.games.finishGame(game.id, "give_up", nowIso, null);
    const answer = await this.readAnswerWord(game.answerId);

    return {
      gameId: game.id,
      status: "give_up",
      answer: answer.word,
      guessCount: game.guessCount,
      endedAt: nowIso
    };
  }

  private async readOwnedGame(visitorId: string, gameId: string): Promise<Game> {
    const game = await this.services.storage.games.findGameById(gameId);
    if (!game || game.visitorId !== visitorId) {
      throw new ApiError({
        code: "game_not_found",
        status: 404,
        message: "游戏不存在。"
      });
    }

    return game;
  }

  private async readAnswerWord(answerId: string): Promise<Word> {
    const answer = await this.services.storage.words.findWordById(answerId);
    if (!answer) {
      throw new ApiError({
        code: "system_error",
        status: 500,
        message: "答案词条不存在。"
      });
    }

    return answer;
  }
}
