import { ApiError, GAME_MAX_GUESSES } from "../../domain/models/api";
import type { Game, Guess, GuessSource, Word } from "../../domain/models/storage";
import { findLocalExactMatch, type RelationType } from "../../domain/scoring/index.mjs";
import { AiGatewayRequestError } from "../../infrastructure/adapters/deepseekAiGatewayScoringClient";
import { ObservabilityService } from "./observabilityService";
import type { AppServices } from "./platformPorts";
import type { AiGuessHistoryContext } from "../scoring/scoringGateway";
import type { AuthenticatedSession } from "./sessionService";
import { GameRuleService } from "./gameRuleService";

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
  expireReason: Game["expireReason"];
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

interface AiCallAttemptPayload {
  guessId?: string | null;
  status: "success" | "error" | "invalid_json";
  latencyMs: number;
  errorCode?: string | null;
  responseStatus?: number | null;
  requestUrl?: string | null;
  requestPath?: string | null;
  responseSummaryPrefix?: string | null;
  hasGatewayAuth?: boolean | null;
  hasByokAlias?: boolean | null;
}

interface GuessSystemErrorDebug {
  response_status: number | null;
  request_path: string | null;
  response_summary_prefix: string | null;
  has_gateway_auth: boolean | null;
  has_byok_alias: boolean | null;
  runtime: {
    version: string;
  };
}

const PUBLIC_DEBUG_RESPONSE_SUMMARY_MAX_LENGTH = 160;

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

function buildGuessHistoryContext(guesses: Guess[]): AiGuessHistoryContext {
  const countedGuesses = guesses.filter((guess) => guess.counted && guess.score !== null);
  const bestGuess =
    countedGuesses.length === 0
      ? null
      : countedGuesses.reduce((best, current) => ((best.score ?? -1) >= (current.score ?? -1) ? best : current));

  return {
    totalPreviousGuesses: countedGuesses.length,
    bestScore: bestGuess?.score ?? null,
    bestGuess: bestGuess?.guessRaw ?? null,
    guesses: countedGuesses.map((guess, index) => ({
      order: index + 1,
      guess: guess.guessRaw,
      score: guess.score ?? 0,
      relationType: guess.relationType ?? "invalid",
      source: guess.source,
      reason: guess.reason
    }))
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
    expireReason: null,
    bestGuess: toBestGuessSummary(params.bestGuess)
  };
}

function durationMilliseconds(startedAt: string, endedAt: string): number {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

export class GuessService {
  constructor(private readonly services: AppServices) {}

  async submitGuess(session: AuthenticatedSession, gameId: string, input: SubmitGuessInput): Promise<SubmitGuessResult> {
    const observability = new ObservabilityService(this.services);
    const gameRuleService = new GameRuleService(this.services);
    const game = await gameRuleService.readPlayableGame(session.visitorId, gameId);
    const answer = await gameRuleService.readAnswerWord(game.answerId);
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
        await observability.trackEvent({
          eventName: "guess_reused",
          visitorId: session.visitorId,
          sessionId: session.session.id,
          page: "game",
          gameId: game.id,
          answerId: game.answerId,
          guessId: existingGuess.id,
          modelName: game.modelName,
          ruleVersion: game.ruleVersion,
          payload: {
            normalized_guess: normalizedGuess,
            score: existingGuess.score ?? null,
            guess_count: game.guessCount
          }
        });
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
      const result = await this.persistCountedGuess(game, answer, {
        guessRaw,
        guessNormalized: normalizedGuess,
        score: localMatch.score,
        aiScore: null,
        relationType: localMatch.relationType,
        reason: null,
        source: "exact_match",
        wasRuleAdjusted: false
      });
      await this.trackGuessEvents(observability, session, game, answer, result, normalizedGuess);
      return result;
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
      const result = await this.persistCountedGuess(game, answer, {
        guessRaw,
        guessNormalized: normalizedGuess,
        score: globalCacheEntry.score,
        aiScore: globalCacheEntry.aiScore,
        relationType: globalCacheEntry.relationType as RelationType,
        reason: globalCacheEntry.reason,
        source: "global_cache",
        wasRuleAdjusted: globalCacheEntry.aiScore !== null && globalCacheEntry.aiScore !== globalCacheEntry.score
      });
      await this.trackGuessEvents(observability, session, game, answer, result, normalizedGuess);
      return result;
    }

    const startedAt = Date.now();
    const guessHistory = buildGuessHistoryContext(await this.services.storage.guesses.listGuessesByGame(game.id, { limit: GAME_MAX_GUESSES }));
    let scored;
    try {
      scored = await this.services.scoringGateway.score({
        answer: answer.word,
        aliases: answer.aliases,
        answerCategories: answer.categories,
        answerTags: answer.tags,
        guess: normalizedGuess,
        guessHistory
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const debug = this.buildSystemErrorDebug(error);
      await this.recordAiFailure(observability, session, game, answer, normalizedGuess, {
        status: "error",
        latencyMs,
        errorCode: "ai_request_failed",
        responseStatus: debug.response_status,
        requestUrl: error instanceof AiGatewayRequestError ? error.diagnostic.requestUrl : null,
        requestPath: debug.request_path,
        responseSummaryPrefix: error instanceof AiGatewayRequestError ? error.diagnostic.responseSummaryPrefix : null,
        hasGatewayAuth: debug.has_gateway_auth,
        hasByokAlias: debug.has_byok_alias
      });

      throw new ApiError({
        code: "system_error",
        status: 500,
        message: "评分暂时不可用，请稍后重试。",
        details: {
          debug
        }
      });
    }

    if (!scored.ok) {
      const latencyMs = Date.now() - startedAt;
      await this.recordAiFailure(observability, session, game, answer, normalizedGuess, {
        status: scored.error.code === "invalid_json" ? "invalid_json" : "error",
        latencyMs,
        errorCode: scored.error.code
      });
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
      reason: scored.value.ai?.reason ?? null,
      source: "model",
      wasRuleAdjusted: scored.value.ai?.wasRuleAdjusted ?? false
    });
    const latencyMs = Date.now() - startedAt;
    await this.recordAiCall(observability, game, {
      guessId: result.guessId,
      status: "success",
      latencyMs
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
      reason: scored.value.ai?.reason ?? null,
      createdAt: this.services.clock.now().toISOString(),
      hitCount: 0,
      lastHitAt: null
    });
    await this.trackGuessEvents(observability, session, game, answer, result, normalizedGuess);

    return result;
  }

  private async persistCountedGuess(game: Game, answer: Word, payload: CountedGuessPayload): Promise<SubmitGuessResult> {
    const createdAt = this.services.clock.now().toISOString();
    const guessId = this.services.idGenerator.next("guess");
    const gameRuleService = new GameRuleService(this.services);

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
    let expireReason: Game["expireReason"] = null;
    if (payload.score === 100 && isExactRelation(payload.relationType)) {
      status = "success";
      answerValue = answer.word;
      await this.services.storage.games.finishGame(game.id, "success", createdAt, null);
    } else if (nextGuessCount >= GAME_MAX_GUESSES) {
      status = "expired";
      answerValue = answer.word;
      expireReason = "guess_limit";
      await gameRuleService.expireByGuessLimit(
        {
          ...game,
          guessCount: nextGuessCount,
          bestGuessId
        },
        createdAt
      );
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
      expireReason,
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

  private async trackGuessEvents(
    observability: ObservabilityService,
    session: AuthenticatedSession,
    game: Game,
    answer: Word,
    result: SubmitGuessResult,
    normalizedGuess: string
  ): Promise<void> {
    await observability.trackEvent({
      eventName: "guess_submitted",
      visitorId: session.visitorId,
      sessionId: session.session.id,
      page: "game",
      gameId: game.id,
      answerId: game.answerId,
      guessId: result.guessId,
      modelName: game.modelName,
      ruleVersion: game.ruleVersion,
      payload: {
        normalized_guess: normalizedGuess,
        score: result.score,
        relation_type: result.relationType,
        source: result.source,
        counted: result.counted,
        guess_count: result.guessCount
      }
    });

    if (result.status === "success") {
      await observability.trackEvent({
        eventName: "game_success",
        visitorId: session.visitorId,
        sessionId: session.session.id,
        page: "result",
        gameId: game.id,
        answerId: game.answerId,
        guessId: result.guessId,
        modelName: game.modelName,
        ruleVersion: game.ruleVersion,
        payload: {
          guess_count: result.guessCount,
          duration_ms: durationMilliseconds(game.startedAt, this.services.clock.now().toISOString()),
          best_score: result.bestGuess?.score ?? result.score
        }
      });
      return;
    }

    if (result.status === "expired") {
      await observability.trackEvent({
        eventName: "game_expired",
        visitorId: session.visitorId,
        sessionId: session.session.id,
        page: "result",
        gameId: game.id,
        answerId: answer.id,
        guessId: result.guessId,
        modelName: game.modelName,
        ruleVersion: game.ruleVersion,
        payload: {
          reason: result.expireReason,
          guess_count: result.guessCount,
          duration_ms: durationMilliseconds(game.startedAt, this.services.clock.now().toISOString()),
          best_score: result.bestGuess?.score ?? result.score
        }
      });
    }
  }

  private async recordAiCall(
    observability: ObservabilityService,
    game: Game,
    payload: AiCallAttemptPayload
  ): Promise<void> {
    await observability.recordAiCall({
      id: this.services.idGenerator.next("ai_call"),
      gameId: game.id,
      guessId: payload.guessId ?? null,
      provider: this.services.scoringProfile.provider,
      modelName: game.modelName,
      thinkingMode: game.thinkingMode,
      ruleVersion: game.ruleVersion,
      latencyMs: payload.latencyMs,
      status: payload.status,
      errorCode: payload.errorCode ?? null,
      responseStatus: payload.responseStatus ?? null,
      requestUrl: payload.requestUrl ?? null,
      requestPath: payload.requestPath ?? null,
      responseSummaryPrefix: payload.responseSummaryPrefix ?? null,
      hasGatewayAuth: payload.hasGatewayAuth ?? null,
      hasByokAlias: payload.hasByokAlias ?? null,
      createdAt: this.services.clock.now().toISOString()
    });
  }

  private async recordAiFailure(
    observability: ObservabilityService,
    session: AuthenticatedSession,
    game: Game,
    answer: Word,
    normalizedGuess: string,
    payload: AiCallAttemptPayload
  ): Promise<void> {
    await this.recordAiCall(observability, game, payload);
    await observability.trackEvent({
      eventName: "ai_error",
      visitorId: session.visitorId,
      sessionId: session.session.id,
      page: "game",
      gameId: game.id,
      answerId: answer.id,
      modelName: game.modelName,
      ruleVersion: game.ruleVersion,
      payload: {
        normalized_guess: normalizedGuess,
        error_code: payload.errorCode ?? null,
        latency_ms: payload.latencyMs
      }
    });
  }

  private buildSystemErrorDebug(error: unknown): GuessSystemErrorDebug {
    if (error instanceof AiGatewayRequestError) {
      return {
        response_status: error.diagnostic.responseStatus,
        request_path: error.diagnostic.requestPath,
        response_summary_prefix: sanitizePublicResponseSummaryPrefix(error.diagnostic.responseSummaryPrefix),
        has_gateway_auth: error.diagnostic.hasGatewayAuth,
        has_byok_alias: error.diagnostic.hasByokAlias,
        runtime: {
          version: this.services.runtimeVersion ?? "unknown"
        }
      };
    }

    return {
      response_status: null,
      request_path: null,
      response_summary_prefix: null,
      has_gateway_auth: null,
      has_byok_alias: null,
      runtime: {
        version: this.services.runtimeVersion ?? "unknown"
      }
    };
  }
}

function sanitizePublicResponseSummaryPrefix(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return null;
  }

  const redactedUrl = normalized.replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]");
  const redactedTokenPair = redactedUrl.replace(
    /\b(token|api[_-]?key|authorization|password|secret)\s*[:=]\s*([^\s,;]+)/gi,
    "$1=[redacted]"
  );
  const redactedBearer = redactedTokenPair.replace(/\bbearer\s+[a-z0-9\-._~+/]+=*/gi, "bearer [redacted]");
  const redactedLongSecret = redactedBearer.replace(/\b[a-z0-9_\-]{24,}\b/gi, "[redacted]");
  const compact = redactedLongSecret.trim();
  if (compact.length === 0) {
    return null;
  }

  return compact.slice(0, PUBLIC_DEBUG_RESPONSE_SUMMARY_MAX_LENGTH);
}
