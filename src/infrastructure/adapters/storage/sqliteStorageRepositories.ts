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
} from "../../../domain/models/storage";
import type {
  AiCallLogRepository,
  FeedbackRepository,
  GameRepository,
  GuessRepository,
  ScoreCacheRepository,
  SessionRepository,
  StorageRepositories,
  WordRepository
} from "../../../usecases/repositories/storageRepositories";
import type { SqlExecutor, SqlValue } from "./sqlExecutor";

type Row = Record<string, unknown>;

function optional(value: string | number | null | undefined): string | number | null {
  return value ?? null;
}

function optionalNumber(value: number | null | undefined): number | null {
  return value ?? null;
}

function booleanToSql(value: boolean): number {
  return value ? 1 : 0;
}

function rowString(row: Row, key: string): string {
  return String(row[key]);
}

function rowNullableString(row: Row, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined ? null : String(value);
}

function rowNumber(row: Row, key: string): number {
  return Number(row[key]);
}

function rowNullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  return value === null || value === undefined ? null : Number(value);
}

function rowBoolean(row: Row, key: string): boolean {
  return Number(row[key]) === 1;
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

async function first<RowType>(db: SqlExecutor, sql: string, values: SqlValue[], map: (row: Row) => RowType): Promise<RowType | null> {
  const row = await db.prepare(sql).bind(...values).first<Row>();
  return row ? map(row) : null;
}

async function all<RowType>(db: SqlExecutor, sql: string, values: SqlValue[], map: (row: Row) => RowType): Promise<RowType[]> {
  const result = await db.prepare(sql).bind(...values).all<Row>();
  return (result.results ?? []).map(map);
}

async function run(db: SqlExecutor, sql: string, values: SqlValue[]): Promise<void> {
  await db.prepare(sql).bind(...values).run();
}

function mapVisitor(row: Row): Visitor {
  return {
    id: rowString(row, "id"),
    createdAt: rowString(row, "created_at"),
    lastSeenAt: rowString(row, "last_seen_at"),
    userAgentHash: rowNullableString(row, "user_agent_hash")
  };
}

function mapSession(row: Row): Session {
  return {
    id: rowString(row, "id"),
    visitorId: rowString(row, "visitor_id"),
    sessionTokenHash: rowString(row, "session_token_hash"),
    expiresAt: rowString(row, "expires_at"),
    createdAt: rowString(row, "created_at"),
    revokedAt: rowNullableString(row, "revoked_at"),
    turnstilePassedAt: rowNullableString(row, "turnstile_passed_at")
  };
}

function mapWord(row: Row): Word {
  return {
    id: rowString(row, "id"),
    word: rowString(row, "word"),
    wordNormalized: rowString(row, "word_normalized"),
    aliases: parseStringArray(row.aliases),
    categories: parseStringArray(row.categories),
    tags: parseStringArray(row.tags),
    difficulty: rowString(row, "difficulty") as Word["difficulty"],
    enabled: rowBoolean(row, "enabled"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at")
  };
}

function mapGame(row: Row): Game {
  return {
    id: rowString(row, "id"),
    visitorId: rowString(row, "visitor_id"),
    answerId: rowString(row, "answer_id"),
    status: rowString(row, "status") as Game["status"],
    ruleVersion: rowString(row, "rule_version"),
    modelName: rowString(row, "model_name"),
    thinkingMode: rowString(row, "thinking_mode") as Game["thinkingMode"],
    guessCount: rowNumber(row, "guess_count"),
    bestGuessId: rowNullableString(row, "best_guess_id"),
    startedAt: rowString(row, "started_at"),
    endedAt: rowNullableString(row, "ended_at"),
    expiresAt: rowNullableString(row, "expires_at"),
    expireReason: rowNullableString(row, "expire_reason") as Game["expireReason"]
  };
}

function mapGuess(row: Row): Guess {
  return {
    id: rowString(row, "id"),
    gameId: rowString(row, "game_id"),
    visitorId: rowString(row, "visitor_id"),
    guessRaw: rowString(row, "guess_raw"),
    guessNormalized: rowString(row, "guess_normalized"),
    score: rowNullableNumber(row, "score"),
    aiScore: rowNullableNumber(row, "ai_score"),
    relationType: rowNullableString(row, "relation_type"),
    reason: rowNullableString(row, "reason"),
    source: rowString(row, "source") as Guess["source"],
    counted: rowBoolean(row, "counted"),
    rejectReason: rowNullableString(row, "reject_reason"),
    wasRuleAdjusted: rowBoolean(row, "was_rule_adjusted"),
    createdAt: rowString(row, "created_at")
  };
}

function mapScoreCache(row: Row): ScoreCacheEntry {
  return {
    cacheKey: rowString(row, "cache_key"),
    answerId: rowString(row, "answer_id"),
    guessNormalized: rowString(row, "guess_normalized"),
    ruleVersion: rowString(row, "rule_version"),
    provider: rowString(row, "provider"),
    modelName: rowString(row, "model_name"),
    thinkingMode: rowString(row, "thinking_mode") as ScoreCacheEntry["thinkingMode"],
    score: rowNumber(row, "score"),
    aiScore: rowNullableNumber(row, "ai_score"),
    relationType: rowString(row, "relation_type"),
    reason: rowNullableString(row, "reason"),
    createdAt: rowString(row, "created_at"),
    hitCount: rowNumber(row, "hit_count"),
    lastHitAt: rowNullableString(row, "last_hit_at")
  };
}

function mapFeedback(row: Row): ScoreFeedback {
  return {
    id: rowString(row, "id"),
    gameId: rowString(row, "game_id"),
    guessId: rowString(row, "guess_id"),
    visitorId: rowString(row, "visitor_id"),
    feedbackType: rowString(row, "feedback_type") as ScoreFeedback["feedbackType"],
    note: rowNullableString(row, "note"),
    createdAt: rowString(row, "created_at")
  };
}

function mapAiCallLog(row: Row): AiCallLog {
  const hasGatewayAuthValue = rowNullableNumber(row, "has_gateway_auth");
  const hasByokAliasValue = rowNullableNumber(row, "has_byok_alias");
  return {
    id: rowString(row, "id"),
    gameId: rowString(row, "game_id"),
    guessId: rowNullableString(row, "guess_id"),
    provider: rowString(row, "provider"),
    modelName: rowString(row, "model_name"),
    thinkingMode: rowString(row, "thinking_mode") as AiCallLog["thinkingMode"],
    gatewaySlug: rowNullableString(row, "gateway_slug"),
    gatewayRequestId: rowNullableString(row, "gateway_request_id"),
    providerRequestId: rowNullableString(row, "provider_request_id"),
    ruleVersion: rowString(row, "rule_version"),
    inputTokens: rowNullableNumber(row, "input_tokens"),
    outputTokens: rowNullableNumber(row, "output_tokens"),
    cacheStatus: rowNullableString(row, "cache_status") as AiCallLog["cacheStatus"],
    latencyMs: rowNumber(row, "latency_ms"),
    estimatedCostUsd: rowNullableNumber(row, "estimated_cost_usd"),
    status: rowString(row, "status") as AiCallLog["status"],
    errorCode: rowNullableString(row, "error_code"),
    responseStatus: rowNullableNumber(row, "response_status"),
    requestUrl: rowNullableString(row, "request_url"),
    requestPath: rowNullableString(row, "request_path"),
    responseSummaryPrefix: rowNullableString(row, "response_summary_prefix"),
    hasGatewayAuth: hasGatewayAuthValue === null ? null : hasGatewayAuthValue === 1,
    hasByokAlias: hasByokAliasValue === null ? null : hasByokAliasValue === 1,
    archiveObjectKey: rowNullableString(row, "archive_object_key"),
    createdAt: rowString(row, "created_at")
  };
}

class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async upsertVisitor(visitor: NewVisitor): Promise<void> {
    await run(
      this.db,
      `INSERT INTO visitors (id, created_at, last_seen_at, user_agent_hash)
       VALUES (?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?)
       ON CONFLICT(id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         user_agent_hash = excluded.user_agent_hash`,
      [visitor.id, optional(visitor.createdAt), optional(visitor.lastSeenAt), optional(visitor.userAgentHash)]
    );
  }

  async touchVisitor(visitorId: string, lastSeenAt: string): Promise<void> {
    await run(this.db, "UPDATE visitors SET last_seen_at = ? WHERE id = ?", [lastSeenAt, visitorId]);
  }

  async createSession(session: NewSession): Promise<void> {
    await run(
      this.db,
      `INSERT INTO sessions (id, visitor_id, session_token_hash, expires_at, created_at, revoked_at, turnstile_passed_at)
       VALUES (?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?, ?)`,
      [
        session.id,
        session.visitorId,
        session.sessionTokenHash,
        session.expiresAt,
        optional(session.createdAt),
        optional(session.revokedAt),
        optional(session.turnstilePassedAt)
      ]
    );
  }

  findVisitorById(visitorId: string): Promise<Visitor | null> {
    return first(this.db, "SELECT * FROM visitors WHERE id = ?", [visitorId], mapVisitor);
  }

  findSessionById(sessionId: string): Promise<Session | null> {
    return first(this.db, "SELECT * FROM sessions WHERE id = ?", [sessionId], mapSession);
  }

  findSessionByTokenHash(sessionTokenHash: string): Promise<Session | null> {
    return first(this.db, "SELECT * FROM sessions WHERE session_token_hash = ?", [sessionTokenHash], mapSession);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    await run(this.db, "UPDATE sessions SET revoked_at = ? WHERE id = ?", [revokedAt, sessionId]);
  }
}

class SqliteWordRepository implements WordRepository {
  constructor(private readonly db: SqlExecutor) {}

  async upsertWord(word: NewWord): Promise<void> {
    await run(
      this.db,
      `INSERT INTO words (id, word, word_normalized, aliases, categories, tags, difficulty, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
       ON CONFLICT(id) DO UPDATE SET
         word = excluded.word,
         word_normalized = excluded.word_normalized,
         aliases = excluded.aliases,
         categories = excluded.categories,
         tags = excluded.tags,
         difficulty = excluded.difficulty,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`,
      [
        word.id,
        word.word,
        word.wordNormalized,
        JSON.stringify(word.aliases),
        JSON.stringify(word.categories),
        JSON.stringify(word.tags),
        word.difficulty,
        booleanToSql(word.enabled),
        optional(word.createdAt),
        optional(word.updatedAt)
      ]
    );
  }

  findWordById(wordId: string): Promise<Word | null> {
    return first(this.db, "SELECT * FROM words WHERE id = ?", [wordId], mapWord);
  }

  findEnabledWordByNormalized(wordNormalized: string): Promise<Word | null> {
    return first(this.db, "SELECT * FROM words WHERE enabled = 1 AND word_normalized = ?", [wordNormalized], mapWord);
  }

  listEnabledWords(options: { difficulty?: Word["difficulty"]; limit?: number } = {}): Promise<Word[]> {
    const clauses = ["enabled = 1"];
    const values: SqlValue[] = [];
    if (options.difficulty) {
      clauses.push("difficulty = ?");
      values.push(options.difficulty);
    }
    values.push(options.limit ?? 100);

    return all(
      this.db,
      `SELECT * FROM words WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC, id ASC LIMIT ?`,
      values,
      mapWord
    );
  }
}

class SqliteGameRepository implements GameRepository {
  constructor(private readonly db: SqlExecutor) {}

  async createGame(game: NewGame): Promise<void> {
    await run(
      this.db,
      `INSERT INTO games (
         id, visitor_id, answer_id, status, rule_version, model_name, thinking_mode,
         guess_count, best_guess_id, started_at, ended_at, expires_at, expire_reason
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?, ?, ?)`,
      [
        game.id,
        game.visitorId,
        game.answerId,
        game.status,
        game.ruleVersion,
        game.modelName,
        game.thinkingMode,
        game.guessCount ?? 0,
        optional(game.bestGuessId),
        optional(game.startedAt),
        optional(game.endedAt),
        optional(game.expiresAt),
        optional(game.expireReason)
      ]
    );
  }

  findGameById(gameId: string): Promise<Game | null> {
    return first(this.db, "SELECT * FROM games WHERE id = ?", [gameId], mapGame);
  }

  listGamesByVisitor(visitorId: string, options: { status?: Game["status"]; limit?: number } = {}): Promise<Game[]> {
    const values: SqlValue[] = [visitorId];
    const clauses = ["visitor_id = ?"];
    if (options.status) {
      clauses.push("status = ?");
      values.push(options.status);
    }
    values.push(options.limit ?? 20);
    return all(
      this.db,
      `SELECT * FROM games WHERE ${clauses.join(" AND ")} ORDER BY started_at DESC, id DESC LIMIT ?`,
      values,
      mapGame
    );
  }

  async incrementGuessCount(gameId: string, amount = 1): Promise<void> {
    await run(this.db, "UPDATE games SET guess_count = guess_count + ? WHERE id = ?", [amount, gameId]);
  }

  async updateBestGuess(gameId: string, bestGuessId: string | null): Promise<void> {
    await run(this.db, "UPDATE games SET best_guess_id = ? WHERE id = ?", [bestGuessId, gameId]);
  }

  async finishGame(gameId: string, status: Exclude<Game["status"], "playing">, endedAt: string, expireReason: Game["expireReason"] = null): Promise<void> {
    await run(this.db, "UPDATE games SET status = ?, ended_at = ?, expire_reason = ? WHERE id = ?", [
      status,
      endedAt,
      expireReason,
      gameId
    ]);
  }
}

class SqliteGuessRepository implements GuessRepository {
  constructor(private readonly db: SqlExecutor) {}

  async createGuess(guess: NewGuess): Promise<void> {
    await run(
      this.db,
      `INSERT INTO guesses (
         id, game_id, visitor_id, guess_raw, guess_normalized, score, ai_score,
         relation_type, reason, source, counted, reject_reason, was_rule_adjusted, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`,
      [
        guess.id,
        guess.gameId,
        guess.visitorId,
        guess.guessRaw,
        guess.guessNormalized,
        optionalNumber(guess.score),
        optionalNumber(guess.aiScore),
        optional(guess.relationType),
        optional(guess.reason),
        guess.source,
        booleanToSql(guess.counted),
        optional(guess.rejectReason),
        booleanToSql(guess.wasRuleAdjusted),
        optional(guess.createdAt)
      ]
    );
  }

  findGuessById(guessId: string): Promise<Guess | null> {
    return first(this.db, "SELECT * FROM guesses WHERE id = ?", [guessId], mapGuess);
  }

  findCountedGuessByGameAndNormalized(gameId: string, guessNormalized: string): Promise<Guess | null> {
    return first(
      this.db,
      "SELECT * FROM guesses WHERE game_id = ? AND guess_normalized = ? AND counted = 1",
      [gameId, guessNormalized],
      mapGuess
    );
  }

  listGuessesByGame(gameId: string, options: { limit?: number } = {}): Promise<Guess[]> {
    return all(
      this.db,
      "SELECT * FROM guesses WHERE game_id = ? ORDER BY created_at ASC, id ASC LIMIT ?",
      [gameId, options.limit ?? 100],
      mapGuess
    );
  }
}

class SqliteScoreCacheRepository implements ScoreCacheRepository {
  constructor(private readonly db: SqlExecutor) {}

  async putScoreCache(entry: NewScoreCacheEntry): Promise<void> {
    await run(
      this.db,
      `INSERT INTO score_cache (
         cache_key, answer_id, guess_normalized, rule_version, provider, model_name, thinking_mode,
         score, ai_score, relation_type, reason, created_at, hit_count, last_hit_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         score = excluded.score,
         ai_score = excluded.ai_score,
         relation_type = excluded.relation_type,
         reason = excluded.reason`,
      [
        entry.cacheKey,
        entry.answerId,
        entry.guessNormalized,
        entry.ruleVersion,
        entry.provider,
        entry.modelName,
        entry.thinkingMode,
        entry.score,
        optionalNumber(entry.aiScore),
        entry.relationType,
        optional(entry.reason),
        optional(entry.createdAt),
        entry.hitCount ?? 0,
        optional(entry.lastHitAt)
      ]
    );
  }

  findScoreCache(params: {
    answerId: string;
    guessNormalized: string;
    ruleVersion: string;
    modelName: string;
    thinkingMode: string;
  }): Promise<ScoreCacheEntry | null> {
    return first(
      this.db,
      `SELECT * FROM score_cache
       WHERE answer_id = ? AND guess_normalized = ? AND rule_version = ? AND model_name = ? AND thinking_mode = ?`,
      [params.answerId, params.guessNormalized, params.ruleVersion, params.modelName, params.thinkingMode],
      mapScoreCache
    );
  }

  async recordScoreCacheHit(cacheKey: string, hitAt: string): Promise<void> {
    await run(this.db, "UPDATE score_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE cache_key = ?", [
      hitAt,
      cacheKey
    ]);
  }
}

class SqliteFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: SqlExecutor) {}

  async createFeedback(feedback: NewScoreFeedback): Promise<void> {
    await run(
      this.db,
      `INSERT INTO score_feedback (id, game_id, guess_id, visitor_id, feedback_type, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`,
      [
        feedback.id,
        feedback.gameId,
        feedback.guessId,
        feedback.visitorId,
        feedback.feedbackType,
        optional(feedback.note),
        optional(feedback.createdAt)
      ]
    );
  }

  findFeedbackById(feedbackId: string): Promise<ScoreFeedback | null> {
    return first(this.db, "SELECT * FROM score_feedback WHERE id = ?", [feedbackId], mapFeedback);
  }

  listFeedbackByGuess(guessId: string, options: { limit?: number } = {}): Promise<ScoreFeedback[]> {
    return all(
      this.db,
      "SELECT * FROM score_feedback WHERE guess_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      [guessId, options.limit ?? 50],
      mapFeedback
    );
  }
}

class SqliteAiCallLogRepository implements AiCallLogRepository {
  constructor(private readonly db: SqlExecutor) {}

  async createAiCallLog(log: NewAiCallLog): Promise<void> {
    await run(
      this.db,
      `INSERT INTO ai_call_logs (
         id, game_id, guess_id, provider, model_name, thinking_mode, gateway_slug,
         gateway_request_id, provider_request_id, rule_version, input_tokens, output_tokens,
         cache_status, latency_ms, estimated_cost_usd, status, error_code, response_status,
         request_url, request_path, response_summary_prefix, has_gateway_auth, has_byok_alias,
         archive_object_key, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`,
      [
        log.id,
        log.gameId,
        optional(log.guessId),
        log.provider,
        log.modelName,
        log.thinkingMode,
        optional(log.gatewaySlug),
        optional(log.gatewayRequestId),
        optional(log.providerRequestId),
        log.ruleVersion,
        optionalNumber(log.inputTokens),
        optionalNumber(log.outputTokens),
        optional(log.cacheStatus),
        log.latencyMs,
        optionalNumber(log.estimatedCostUsd),
        log.status,
        optional(log.errorCode),
        optionalNumber(log.responseStatus),
        optional(log.requestUrl),
        optional(log.requestPath),
        optional(log.responseSummaryPrefix),
        log.hasGatewayAuth === null || log.hasGatewayAuth === undefined ? null : log.hasGatewayAuth ? 1 : 0,
        log.hasByokAlias === null || log.hasByokAlias === undefined ? null : log.hasByokAlias ? 1 : 0,
        optional(log.archiveObjectKey),
        optional(log.createdAt)
      ]
    );
  }

  findAiCallLogById(logId: string): Promise<AiCallLog | null> {
    return first(this.db, "SELECT * FROM ai_call_logs WHERE id = ?", [logId], mapAiCallLog);
  }

  listAiCallLogsByGame(gameId: string, options: { limit?: number } = {}): Promise<AiCallLog[]> {
    return all(
      this.db,
      "SELECT * FROM ai_call_logs WHERE game_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      [gameId, options.limit ?? 50],
      mapAiCallLog
    );
  }
}

export function createSqliteStorageRepositories(db: SqlExecutor): StorageRepositories {
  return {
    sessions: new SqliteSessionRepository(db),
    words: new SqliteWordRepository(db),
    games: new SqliteGameRepository(db),
    guesses: new SqliteGuessRepository(db),
    scoreCache: new SqliteScoreCacheRepository(db),
    feedback: new SqliteFeedbackRepository(db),
    aiCallLogs: new SqliteAiCallLogRepository(db)
  };
}
