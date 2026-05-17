import { ApiError, GAME_MAX_GUESSES } from "../../domain/models/api";
import type { Game, GameExpireReason, Word } from "../../domain/models/storage";
import type { AppServices } from "./platformPorts";

function resolveExpireReason(game: Game, now: Date): GameExpireReason | null {
  if (game.status !== "playing") {
    return null;
  }

  if (game.guessCount >= GAME_MAX_GUESSES) {
    return "guess_limit";
  }

  if (game.expiresAt && new Date(game.expiresAt).getTime() <= now.getTime()) {
    return "ttl";
  }

  return null;
}

export class GameRuleService {
  constructor(private readonly services: AppServices) {}

  async readOwnedGame(visitorId: string, gameId: string): Promise<Game> {
    const game = await this.services.storage.games.findGameById(gameId);
    if (!game || game.visitorId !== visitorId) {
      throw new ApiError({
        code: "game_not_found",
        status: 404,
        message: "游戏不存在。"
      });
    }

    return this.materializeExpiration(game);
  }

  async readPlayableGame(visitorId: string, gameId: string): Promise<Game> {
    const game = await this.readOwnedGame(visitorId, gameId);
    if (game.status !== "playing") {
      throw new ApiError({
        code: "game_ended",
        status: 409,
        message: "当前游戏已结束。"
      });
    }

    return game;
  }

  async readAnswerWord(answerId: string): Promise<Word> {
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

  async materializeExpiration(game: Game): Promise<Game> {
    const now = this.services.clock.now();
    const expireReason = resolveExpireReason(game, now);
    if (!expireReason) {
      return game;
    }

    const endedAt = expireReason === "ttl" && game.expiresAt ? game.expiresAt : now.toISOString();
    await this.services.storage.games.finishGame(game.id, "expired", endedAt, expireReason);

    return {
      ...game,
      status: "expired",
      endedAt,
      expireReason
    };
  }

  async expireByGuessLimit(game: Game, endedAt: string): Promise<Game> {
    await this.services.storage.games.finishGame(game.id, "expired", endedAt, "guess_limit");

    return {
      ...game,
      status: "expired",
      endedAt,
      expireReason: "guess_limit"
    };
  }
}
