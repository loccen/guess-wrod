import { describe, expect, it } from "vitest";
import { LocalSensitiveTermChecker } from "../../infrastructure/adapters/sensitiveTerms";
import { SignedSessionTokenService } from "../../infrastructure/adapters/sessionTokenService";
import { Sha256ValueHasher } from "../../infrastructure/adapters/sha256ValueHasher";
import { StubScoringClient, type StubScoringRule } from "../../infrastructure/adapters/stubScoringClient";
import type {
  AiCallLog,
  Game,
  Guess,
  NewAiCallLog,
  NewGame,
  NewGuess,
  NewScoreCacheEntry,
  NewScoreFeedback,
  NewSession,
  NewVisitor,
  NewWord,
  ScoreCacheEntry,
  ScoreFeedback,
  Session,
  Visitor,
  Word
} from "../../domain/models/storage";
import { ScoringGateway } from "../../usecases/scoring/scoringGateway";
import type { StorageRepositories } from "../../usecases/repositories/storageRepositories";
import type { AppServices, CaptchaVerificationResult, Clock, IdGenerator, RandomSource } from "../../usecases/services/platformPorts";
import { createGameResponse, getGameResponse, giveUpGameResponse, submitGuessResponse } from "./gameHandlers";
import { createSessionResponse, getSessionResponse } from "./sessionHandlers";

class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }
}

class SequenceIdGenerator implements IdGenerator {
  private value = 0;

  next(prefix: string): string {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
}

class FixedRandomSource implements RandomSource {
  constructor(private readonly value: number) {}

  next(): number {
    return this.value;
  }
}

class StubCaptchaVerifier {
  constructor(private readonly result: CaptchaVerificationResult) {}

  async verify(): Promise<CaptchaVerificationResult> {
    return this.result;
  }
}

class MemoryStorageRepositories implements StorageRepositories {
  private readonly visitorStore = new Map<string, Visitor>();
  private readonly sessionStore = new Map<string, Session>();
  private readonly wordStore = new Map<string, Word>();
  private readonly gameStore = new Map<string, Game>();
  private readonly guessStore = new Map<string, Guess>();
  private readonly scoreCacheStore = new Map<string, ScoreCacheEntry>();
  private readonly feedbackStore = new Map<string, ScoreFeedback>();
  private readonly aiCallLogStore = new Map<string, AiCallLog>();

  readonly sessionsRepository = {
    upsertVisitor: async (visitor: NewVisitor) => {
      const existing = this.visitorStore.get(visitor.id);
      this.visitorStore.set(visitor.id, {
        id: visitor.id,
        createdAt: visitor.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
        lastSeenAt: visitor.lastSeenAt ?? new Date().toISOString(),
        userAgentHash: visitor.userAgentHash ?? null
      });
    },
    touchVisitor: async (visitorId: string, lastSeenAt: string) => {
      const visitor = this.visitorStore.get(visitorId);
      if (visitor) {
        this.visitorStore.set(visitorId, { ...visitor, lastSeenAt });
      }
    },
    createSession: async (session: NewSession) => {
      this.sessionStore.set(session.id, {
        id: session.id,
        visitorId: session.visitorId,
        sessionTokenHash: session.sessionTokenHash,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt ?? new Date().toISOString(),
        revokedAt: session.revokedAt ?? null,
        turnstilePassedAt: session.turnstilePassedAt ?? null
      });
    },
    findVisitorById: async (visitorId: string) => this.visitorStore.get(visitorId) ?? null,
    findSessionById: async (sessionId: string) => this.sessionStore.get(sessionId) ?? null,
    findSessionByTokenHash: async (sessionTokenHash: string) =>
      Array.from(this.sessionStore.values()).find((session) => session.sessionTokenHash === sessionTokenHash) ?? null,
    revokeSession: async (sessionId: string, revokedAt: string) => {
      const session = this.sessionStore.get(sessionId);
      if (session) {
        this.sessionStore.set(sessionId, { ...session, revokedAt });
      }
    }
  } satisfies StorageRepositories["sessions"];

  readonly wordsRepository = {
    upsertWord: async (word: NewWord) => {
      this.wordStore.set(word.id, {
        id: word.id,
        word: word.word,
        wordNormalized: word.wordNormalized,
        aliases: word.aliases,
        categories: word.categories,
        tags: word.tags,
        difficulty: word.difficulty,
        enabled: word.enabled,
        createdAt: word.createdAt ?? new Date().toISOString(),
        updatedAt: word.updatedAt ?? new Date().toISOString()
      });
    },
    findWordById: async (wordId: string) => this.wordStore.get(wordId) ?? null,
    findEnabledWordByNormalized: async (wordNormalized: string) =>
      Array.from(this.wordStore.values()).find((word) => word.enabled && word.wordNormalized === wordNormalized) ?? null,
    listEnabledWords: async (options?: { difficulty?: Word["difficulty"]; limit?: number }) =>
      Array.from(this.wordStore.values())
        .filter((word) => word.enabled && (!options?.difficulty || word.difficulty === options.difficulty))
        .slice(0, options?.limit ?? 100)
  } satisfies StorageRepositories["words"];

  readonly gamesRepository = {
    createGame: async (game: NewGame) => {
      this.gameStore.set(game.id, {
        id: game.id,
        visitorId: game.visitorId,
        answerId: game.answerId,
        status: game.status,
        ruleVersion: game.ruleVersion,
        modelName: game.modelName,
        thinkingMode: game.thinkingMode,
        guessCount: game.guessCount ?? 0,
        bestGuessId: game.bestGuessId ?? null,
        startedAt: game.startedAt ?? new Date().toISOString(),
        endedAt: game.endedAt ?? null,
        expiresAt: game.expiresAt ?? null,
        expireReason: game.expireReason ?? null
      });
    },
    findGameById: async (gameId: string) => this.gameStore.get(gameId) ?? null,
    listGamesByVisitor: async (visitorId: string, options?: { status?: Game["status"]; limit?: number }) =>
      Array.from(this.gameStore.values())
        .filter((game) => game.visitorId === visitorId && (!options?.status || game.status === options.status))
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .slice(0, options?.limit ?? 20),
    incrementGuessCount: async (gameId: string, amount = 1) => {
      const game = this.gameStore.get(gameId);
      if (game) {
        this.gameStore.set(gameId, { ...game, guessCount: game.guessCount + amount });
      }
    },
    updateBestGuess: async (gameId: string, bestGuessId: string | null) => {
      const game = this.gameStore.get(gameId);
      if (game) {
        this.gameStore.set(gameId, { ...game, bestGuessId });
      }
    },
    finishGame: async (gameId: string, status: Exclude<Game["status"], "playing">, endedAt: string, expireReason?: Game["expireReason"] | null) => {
      const game = this.gameStore.get(gameId);
      if (game) {
        this.gameStore.set(gameId, { ...game, status, endedAt, expireReason: expireReason ?? null });
      }
    }
  } satisfies StorageRepositories["games"];

  readonly guessesRepository = {
    createGuess: async (guess: NewGuess) => {
      this.guessStore.set(guess.id, {
        id: guess.id,
        gameId: guess.gameId,
        visitorId: guess.visitorId,
        guessRaw: guess.guessRaw,
        guessNormalized: guess.guessNormalized,
        score: guess.score ?? null,
        aiScore: guess.aiScore ?? null,
        relationType: guess.relationType ?? null,
        reason: guess.reason ?? null,
        source: guess.source,
        counted: guess.counted,
        rejectReason: guess.rejectReason ?? null,
        wasRuleAdjusted: guess.wasRuleAdjusted,
        createdAt: guess.createdAt ?? new Date().toISOString()
      });
    },
    findGuessById: async (guessId: string) => this.guessStore.get(guessId) ?? null,
    findCountedGuessByGameAndNormalized: async (gameId: string, guessNormalized: string) =>
      Array.from(this.guessStore.values()).find((guess) => guess.gameId === gameId && guess.guessNormalized === guessNormalized && guess.counted) ?? null,
    listGuessesByGame: async (gameId: string, options?: { limit?: number }) =>
      Array.from(this.guessStore.values())
        .filter((guess) => guess.gameId === gameId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .slice(0, options?.limit ?? 100)
  } satisfies StorageRepositories["guesses"];

  readonly scoreCacheRepository = {
    putScoreCache: async (entry: NewScoreCacheEntry) => {
      this.scoreCacheStore.set(entry.cacheKey, {
        cacheKey: entry.cacheKey,
        answerId: entry.answerId,
        guessNormalized: entry.guessNormalized,
        ruleVersion: entry.ruleVersion,
        provider: entry.provider,
        modelName: entry.modelName,
        thinkingMode: entry.thinkingMode,
        score: entry.score,
        aiScore: entry.aiScore ?? null,
        relationType: entry.relationType,
        reason: entry.reason ?? null,
        createdAt: entry.createdAt ?? new Date().toISOString(),
        hitCount: entry.hitCount ?? 0,
        lastHitAt: entry.lastHitAt ?? null
      });
    },
    findScoreCache: async (params) =>
      Array.from(this.scoreCacheStore.values()).find(
        (entry) =>
          entry.answerId === params.answerId &&
          entry.guessNormalized === params.guessNormalized &&
          entry.ruleVersion === params.ruleVersion &&
          entry.modelName === params.modelName &&
          entry.thinkingMode === params.thinkingMode
      ) ?? null,
    recordScoreCacheHit: async (cacheKey: string, hitAt: string) => {
      const entry = this.scoreCacheStore.get(cacheKey);
      if (entry) {
        this.scoreCacheStore.set(cacheKey, {
          ...entry,
          hitCount: entry.hitCount + 1,
          lastHitAt: hitAt
        });
      }
    }
  } satisfies StorageRepositories["scoreCache"];

  readonly feedbackRepository = {
    createFeedback: async (feedback: NewScoreFeedback) => {
      this.feedbackStore.set(feedback.id, {
        id: feedback.id,
        gameId: feedback.gameId,
        guessId: feedback.guessId,
        visitorId: feedback.visitorId,
        feedbackType: feedback.feedbackType,
        note: feedback.note ?? null,
        createdAt: feedback.createdAt ?? new Date().toISOString()
      });
    },
    findFeedbackById: async (feedbackId: string) => this.feedbackStore.get(feedbackId) ?? null,
    listFeedbackByGuess: async () => Array.from(this.feedbackStore.values())
  } satisfies StorageRepositories["feedback"];

  readonly aiCallLogsRepository = {
    createAiCallLog: async (log: NewAiCallLog) => {
      this.aiCallLogStore.set(log.id, {
        id: log.id,
        gameId: log.gameId,
        guessId: log.guessId ?? null,
        provider: log.provider,
        modelName: log.modelName,
        thinkingMode: log.thinkingMode,
        gatewaySlug: log.gatewaySlug ?? null,
        gatewayRequestId: log.gatewayRequestId ?? null,
        providerRequestId: log.providerRequestId ?? null,
        ruleVersion: log.ruleVersion,
        inputTokens: log.inputTokens ?? null,
        outputTokens: log.outputTokens ?? null,
        cacheStatus: log.cacheStatus ?? null,
        latencyMs: log.latencyMs,
        estimatedCostUsd: log.estimatedCostUsd ?? null,
        status: log.status,
        errorCode: log.errorCode ?? null,
        archiveObjectKey: log.archiveObjectKey ?? null,
        createdAt: log.createdAt ?? new Date().toISOString()
      });
    },
    findAiCallLogById: async (logId: string) => this.aiCallLogStore.get(logId) ?? null,
    listAiCallLogsByGame: async () => Array.from(this.aiCallLogStore.values())
  } satisfies StorageRepositories["aiCallLogs"];

  sessions = this.sessionsRepository;
  words = this.wordsRepository;
  games = this.gamesRepository;
  guesses = this.guessesRepository;
  scoreCache = this.scoreCacheRepository;
  feedback = this.feedbackRepository;
  aiCallLogs = this.aiCallLogsRepository;
}

async function createServices(
  now = "2026-05-17T10:00:00.000Z",
  scoringRules: StubScoringRule[] = []
): Promise<AppServices> {
  const storage = new MemoryStorageRepositories();
  await storage.words.upsertWord({
    id: "word_1",
    word: "手机",
    wordNormalized: "手机",
    aliases: ["智能手机", "移动电话"],
    categories: ["电子产品"],
    tags: ["可携带"],
    difficulty: "easy",
    enabled: true,
    createdAt: now,
    updatedAt: now
  });

  return {
    storage,
    clock: new FixedClock(new Date(now)),
    idGenerator: new SequenceIdGenerator(),
    randomSource: new FixedRandomSource(0),
    sessionTokenService: new SignedSessionTokenService("test-secret"),
    captchaVerifier: new StubCaptchaVerifier({
      ok: true,
      passedAt: now
    }),
    valueHasher: new Sha256ValueHasher(),
    sensitiveTermChecker: new LocalSensitiveTermChecker(),
    scoringGateway: new ScoringGateway(new StubScoringClient(scoringRules)),
    scoringProfile: {
      provider: "stub",
      modelName: "deepseek-v4-flash",
      thinkingMode: "disabled"
    }
  };
}

async function createGame(services: AppServices, authorization: string): Promise<string> {
  const response = await createGameResponse(
    new Request("https://example.com/api/games", {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json"
      },
      body: JSON.stringify({ mode: "random" })
    }),
    services
  );
  const payload = (await response.json()) as Record<string, any>;
  return String(payload.data.game_id);
}

async function createAuthorizedRequest(services: AppServices, sessionExpiresAt = "2026-06-16T10:00:00.000Z"): Promise<{ authorization: string; visitorId: string }> {
  const visitorId = "visitor_existing";
  const sessionId = "session_existing";
  const token = await services.sessionTokenService.issue({
    sessionId,
    visitorId,
    expiresAt: sessionExpiresAt
  });
  const sessionTokenHash = await services.sessionTokenService.hash(token);
  const now = services.clock.now().toISOString();

  await services.storage.sessions.upsertVisitor({
    id: visitorId,
    createdAt: now,
    lastSeenAt: now,
    userAgentHash: null
  });
  await services.storage.sessions.createSession({
    id: sessionId,
    visitorId,
    sessionTokenHash,
    expiresAt: sessionExpiresAt,
    createdAt: now
  });

  return {
    authorization: `Bearer ${token}`,
    visitorId
  };
}

describe("session and game handlers", () => {
  it("creates a session and returns token plus expiry", async () => {
    const services = await createServices();
    const response = await createSessionResponse(
      new Request("https://example.com/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest"
        },
        body: JSON.stringify({
          client_timezone: "Asia/Shanghai"
        })
      }),
      services
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.visitor_id).toMatch(/^visitor_/);
    expect(payload.data.session_token).toContain("gw1.");
    expect(payload.data.expires_at).toBe("2026-06-16T10:00:00.000Z");
  });

  it("returns unauthorized when session header is missing", async () => {
    const services = await createServices();
    const response = await getSessionResponse(new Request("https://example.com/api/session"), services);
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("unauthorized");
  });

  it("returns unauthorized when the token is expired", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services, "2026-05-16T10:00:00.000Z");
    const response = await getSessionResponse(
      new Request("https://example.com/api/session", {
        headers: {
          authorization
        }
      }),
      services
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("unauthorized");
  });

  it("creates a game without exposing the answer and reports it as active session game", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    const createResponse = await createGameResponse(
      new Request("https://example.com/api/games", {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode: "random" })
      }),
      services
    );
    const createPayload = (await createResponse.json()) as Record<string, any>;
    const sessionResponse = await getSessionResponse(
      new Request("https://example.com/api/session", {
        headers: {
          authorization
        }
      }),
      services
    );
    const sessionPayload = (await sessionResponse.json()) as Record<string, any>;

    expect(createResponse.status).toBe(200);
    expect(createPayload.data.answer).toBeUndefined();
    expect(createPayload.data.game_id).toBe("game_1");
    expect(createPayload.data.status).toBe("playing");
    expect(sessionPayload.data.active_game_id).toBe("game_1");
  });

  it("does not expose the answer while the game is still playing", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    await createGameResponse(
      new Request("https://example.com/api/games", {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode: "random" })
      }),
      services
    );

    const response = await getGameResponse(
      new Request("https://example.com/api/games/game_1", {
        headers: {
          authorization
        }
      }),
      services,
      "game_1"
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("playing");
    expect(payload.data.answer).toBeUndefined();
    expect(payload.data.guesses).toEqual([]);
  });

  it("returns the answer after give-up and keeps the game out of playing state", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    await createGameResponse(
      new Request("https://example.com/api/games", {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode: "random" })
      }),
      services
    );

    const giveUpResponse = await giveUpGameResponse(
      new Request("https://example.com/api/games/game_1/give-up", {
        method: "POST",
        headers: {
          authorization
        }
      }),
      services,
      "game_1"
    );
    const giveUpPayload = (await giveUpResponse.json()) as Record<string, any>;
    const statusResponse = await getGameResponse(
      new Request("https://example.com/api/games/game_1", {
        headers: {
          authorization
        }
      }),
      services,
      "game_1"
    );
    const statusPayload = (await statusResponse.json()) as Record<string, any>;

    expect(giveUpResponse.status).toBe(200);
    expect(giveUpPayload.data.answer).toBe("手机");
    expect(statusPayload.data.status).toBe("give_up");
    expect(statusPayload.data.answer).toBe("手机");
    expect(statusPayload.data.answer_aliases).toEqual(["智能手机", "移动电话"]);
  });

  it("rejects empty guess input", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "   " })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("invalid_guess");
    expect(payload.error.counted).toBe(false);
  });

  it("normalizes full-width and uppercase guess before scoring", async () => {
    const services = await createServices("2026-05-17T10:00:00.000Z", [
      {
        guess: "test",
        response: {
          score: 67,
          relation_type: "same_category",
          is_exact: false
        }
      }
    ]);
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: " ＴＥＳＴ " })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.guess).toBe("ＴＥＳＴ");
    expect(payload.data.normalized_guess).toBe("test");
    expect(payload.data.source).toBe("model");
    expect(payload.data.guess_count).toBe(1);
  });

  it("rejects sensitive guesses before scoring", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "诈骗电话" })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("sensitive_word");
  });

  it("marks alias guesses as exact success without calling AI", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "移动电话" })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.relation_type).toBe("alias");
    expect(payload.data.is_exact).toBe(true);
    expect(payload.data.source).toBe("exact_match");
    expect(payload.data.status).toBe("success");
    expect(payload.data.answer).toBe("手机");
    expect(payload.data.guess_count).toBe(1);
  });

  it("reuses the same counted guess within one game without incrementing guess count", async () => {
    const services = await createServices("2026-05-17T10:00:00.000Z", [
      {
        guess: "平板",
        response: {
          score: 76,
          relation_type: "same_category",
          is_exact: false
        }
      }
    ]);
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);

    const firstResponse = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "平板" })
      }),
      services,
      gameId
    );
    const firstPayload = (await firstResponse.json()) as Record<string, any>;

    const secondResponse = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "平板" })
      }),
      services,
      gameId
    );
    const secondPayload = (await secondResponse.json()) as Record<string, any>;

    expect(firstPayload.data.guess_id).toBe("guess_2");
    expect(secondResponse.status).toBe(200);
    expect(secondPayload.data.guess_id).toBe("guess_2");
    expect(secondPayload.data.source).toBe("game_cache");
    expect(secondPayload.data.counted).toBe(false);
    expect(secondPayload.data.guess_count).toBe(1);
  });

  it("reuses global cache across games and still counts as a new valid guess", async () => {
    const services = await createServices("2026-05-17T10:00:00.000Z", [
      {
        guess: "平板",
        response: {
          score: 76,
          relation_type: "same_category",
          is_exact: false
        }
      }
    ]);
    const { authorization } = await createAuthorizedRequest(services);
    const firstGameId = await createGame(services, authorization);
    await submitGuessResponse(
      new Request(`https://example.com/api/games/${firstGameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "平板" })
      }),
      services,
      firstGameId
    );
    await giveUpGameResponse(
      new Request(`https://example.com/api/games/${firstGameId}/give-up`, {
        method: "POST",
        headers: { authorization }
      }),
      services,
      firstGameId
    );

    const secondGameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${secondGameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "平板" })
      }),
      services,
      secondGameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.source).toBe("global_cache");
    expect(payload.data.counted).toBe(true);
    expect(payload.data.guess_count).toBe(1);
  });

  it("uses stub model scoring path as a counted guess", async () => {
    const services = await createServices("2026-05-17T10:00:00.000Z", [
      {
        guess: "维修",
        response: {
          score: 72,
          relation_type: "service_context",
          is_exact: false
        }
      }
    ]);
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "维修" })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(payload.data.source).toBe("model");
    expect(payload.data.counted).toBe(true);
    expect(payload.data.guess_count).toBe(1);
    expect(payload.data.best_guess.score).toBe(72);
  });

  it("rejects guesses after the game has already ended", async () => {
    const services = await createServices();
    const { authorization } = await createAuthorizedRequest(services);
    const gameId = await createGame(services, authorization);
    await giveUpGameResponse(
      new Request(`https://example.com/api/games/${gameId}/give-up`, {
        method: "POST",
        headers: { authorization }
      }),
      services,
      gameId
    );

    const response = await submitGuessResponse(
      new Request(`https://example.com/api/games/${gameId}/guesses`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json"
        },
        body: JSON.stringify({ guess: "平板" })
      }),
      services,
      gameId
    );
    const payload = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("game_ended");
  });
});
