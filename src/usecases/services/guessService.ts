import { ApiError } from "../../domain/models/api";
import type { Game, Guess, GuessSource, Word } from "../../domain/models/storage";
import { findLocalExactMatch, type RelationType } from "../../domain/scoring/index.mjs";
import type { AppServices } from "./platformPorts";
import type { AuthenticatedSession } from "./sessionService";

export interface SubmitGuessInput {
  guess: unknown;
}

export interface SubmitGuessResult {
  guessId: string;
  guess: string;
  normalizedGuess: string;
  score: number;
  relationType: string;
  isExact: boolean;
  status: Game["status"];
  source: GuessSource;
  counted: boolean;
  guessCount: number;
  bestGuess: {
    guessId: string;
    guess: string;
    score: number;
  } | null;
  answer?: string;
}

interface CountedGuessPayload {
  guessRaw: string;
  guessNormalized: string;
  score: number;
  aiScore: number | null;
  relationType: RelationType;
  reason: string | null;
  source: Exclude<GuessSource, "game_cache" | "fallback">;
  wasRuleAdjusted: boolean;
}

function isExactRelation(relationType: string): boolean {
  return relationType === "exact" || relationType === "alias";
}

function buildCacheKey(game: Game, guessNormalized: string): string {
  return [game.answerId, guessNormalized, game.ruleVersion, game.modelName, game.thinkingMode].join(":");
}

function toBestGuessSummary(guess: Guess | null): SubmitGuessResult["bestGuess"] {
  if (!guess || guess.score === null) {
    return null;
  }

  return {
    guessId: guess.id,
    guess: guess.guessRaw,
    score: guess.score
  };
}

function toCachedResponse(params: {
  cachedGuess: Guess;
  guessRaw: string;
  normalizedGuess: string;
  guessCount: number;
  bestGuess: Guess | null;
}): SubmitGuessResult {
  return {
    guessId: params.cachedGuess.id,
    guess: params.guessRaw,
    normalizedGuess: params.normalizedGuess,
    score: params.cachedGuess.score ?? 0,
    relationType: params.cachedGuess.relationType ?? "invalid",
    isExact: isExactRelation(params.cachedGuess.relationType ?? ""),
    status: "playing",
    source: "game_cache",
    counted: false,
    guessCount: params.guessCount,
    bestGuess: toBestGuessSummary(params.bestGuess)
  };
}

export class GuessService {
  constructor(private readonly services: AppServices) {}

  async submitGuess(session: AuthenticatedSession, gameId: string, input: SubmitGuessInput): Promise<SubmitGuessResult> {
    const game = await this.readOwnedGame(session.visitorId, gameId);
    if (game.status !== "playing") {
      throw new ApiError({
        code: "game_ended",
        status: 409,
        message: "当前游戏已结束。"
      });
    }

    const answer = await this.readAnswerWord(game.answerId);
    const guessRaw = typeof input.guess === "string" ? input.guess.trim() : "";
    const localMatch = findLocalExactMatch({
      guess: input.guess,
      answer: answer.word,
      aliases: answer.aliases
    });

    if (!localMatch.ok) {
      throw this.toInvalidGuessError(localMatch.error.code);
    }

    const normalizedGuess = localMatch.guessNormalized;
    if (this.services.sensitiveTermChecker.matches(normalizedGuess)) {
      throw new ApiError({
        code: "sensitive_word",
        status: 400,
        message: "猜词包含敏感内容，请更换后重试。"
      });
    }

    if (!localMatch.matched) {
      const existingGuess = await this.services.storage.guesses.findCountedGuessByGameAndNormalized(game.id, normalizedGuess);
      if (existingGuess) {
        const bestGuess = await this.readBestGuess(game);
        return toCachedResponse({
          cachedGuess: existingGuess,
          guessRaw,
          normalizedGuess,
          guessCount: game.guessCount,
          bestGuess
        });
      }
    }

    if (localMatch.matched) {
      return this.persistCountedGuess(game, answer, {
        guessRaw,
        guessNormalized: normalizedGuess,
        score: localMatch.score,
        aiScore: null,
        relationType: localMatch.relationType,
        reason: null,
        source: "exact_match",
        wasRuleAdjusted: false
      });
    }

    const globalCacheEntry = await this.services.storage.scoreCache.findScoreCache({
      answerId: game.answerId,
      guessNormalized: normalizedGuess,
      ruleVersion: game.ruleVersion,
      modelName: game.modelName,
      thinkingMode: game.thinkingMode
    });

    if (globalCacheEntry) {
      await this.services.storage.scoreCache.recordScoreCacheHit(globalCacheEntry.cacheKey, this.services.clock.now().toISOString());
      return this.persistCountedGuess(game, answer, {
        guessRaw,
        guessNormalized: normalizedGuess,
        score: globalCacheEntry.score,
        aiScore: globalCacheEntry.aiScore,
        relationType: globalCacheEntry.relationType as RelationType,
        reason: globalCacheEntry.reason,
        source: "global_cache",
        wasRuleAdjusted: globalCacheEntry.aiScore !== null && globalCacheEntry.aiScore !== globalCacheEntry.score
      });
    }

    try {
      const scored = await this.services.scoringGateway.score({
        answer: answer.word,
        aliases: answer.aliases,
        guess: normalizedGuess
      });

      if (!scored.ok) {
        throw new ApiError({
          code: "system_error",
          status: 500,
          message: "评分暂时不可用，请稍后重试。"
        });
      }

      const result = await this.persistCountedGuess(game, answer, {
        guessRaw,
        guessNormalized: normalizedGuess,
        score: scored.value.score,
        aiScore: scored.value.ai?.rawScore === undefined ? null : Number(scored.value.ai.rawScore),
        relationType: scored.value.relationType,
        reason: scored.value.ai?.confidence === undefined ? null : null,
        source: "model",
        wasRuleAdjusted: scored.value.ai?.wasRuleAdjusted ?? false
      });

      await this.services.storage.scoreCache.putScoreCache({
        cacheKey: buildCacheKey(game, normalizedGuess),
        answerId: game.answerId,
        guessNormalized: normalizedGuess,
        ruleVersion: game.ruleVersion,
        provider: this.services.scoringProfile.provider,
        modelName: game.modelName,
        thinkingMode: game.thinkingMode,
        score: scored.value.score,
        aiScore: scored.value.ai ? Number(scored.value.ai.rawScore) : null,
        relationType: scored.value.relationType,
        reason: null,
        createdAt: this.services.clock.now().toISOString(),
        hitCount: 0,
        lastHitAt: null
      });

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({
        code: "system_error",
        status: 500,
        message: "评分暂时不可用，请稍后重试。"
      });
    }
  }

  private async persistCountedGuess(game: Game, answer: Word, payload: CountedGuessPayload): Promise<SubmitGuessResult> {
    const createdAt = this.services.clock.now().toISOString();
    const guessId = this.services.idGenerator.next("guess");

    await this.services.storage.guesses.createGuess({
      id: guessId,
      gameId: game.id,
      visitorId: game.visitorId,
      guessRaw: payload.guessRaw,
      guessNormalized: payload.guessNormalized,
      score: payload.score,
      aiScore: payload.aiScore,
      relationType: payload.relationType,
      reason: payload.reason,
      source: payload.source,
      counted: true,
      rejectReason: null,
      wasRuleAdjusted: payload.wasRuleAdjusted,
      createdAt
    });

    const nextGuessCount = game.guessCount + 1;
    await this.services.storage.games.incrementGuessCount(game.id, 1);

    let bestGuess = await this.readBestGuess(game);
    let bestGuessId = game.bestGuessId;
    if (!bestGuess || (bestGuess.score ?? -1) < payload.score) {
      bestGuessId = guessId;
      await this.services.storage.games.updateBestGuess(game.id, guessId);
      bestGuess = {
        id: guessId,
        gameId: game.id,
        visitorId: game.visitorId,
        guessRaw: payload.guessRaw,
        guessNormalized: payload.guessNormalized,
        score: payload.score,
        aiScore: payload.aiScore,
        relationType: payload.relationType,
        reason: payload.reason,
        source: payload.source,
        counted: true,
        rejectReason: null,
        wasRuleAdjusted: payload.wasRuleAdjusted,
        createdAt
      };
    }

    let status: Game["status"] = "playing";
    let answerValue: string | undefined;
    if (payload.score === 100 && isExactRelation(payload.relationType)) {
      status = "success";
      answerValue = answer.word;
      await this.services.storage.games.finishGame(game.id, "success", createdAt, null);
    }

    return {
      guessId,
      guess: payload.guessRaw,
      normalizedGuess: payload.guessNormalized,
      score: payload.score,
      relationType: payload.relationType,
      isExact: isExactRelation(payload.relationType),
      status,
      source: payload.source,
      counted: true,
      guessCount: nextGuessCount,
      bestGuess:
        bestGuessId === guessId
          ? {
              guessId,
              guess: payload.guessRaw,
              score: payload.score
            }
          : toBestGuessSummary(bestGuess),
      ...(answerValue ? { answer: answerValue } : {})
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

  private async readBestGuess(game: Game): Promise<Guess | null> {
    if (!game.bestGuessId) {
      return null;
    }

    return this.services.storage.guesses.findGuessById(game.bestGuessId);
  }

  private toInvalidGuessError(code: string): ApiError {
    const message =
      code === "too_long" ? "猜词长度不能超过 20 个字符。" : "猜词不能为空，且必须是有效文本。";

    return new ApiError({
      code: "invalid_guess",
      status: 400,
      message
    });
  }
}
