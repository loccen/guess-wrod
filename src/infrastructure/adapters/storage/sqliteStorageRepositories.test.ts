import { describe, expect, it } from "vitest";
import { createSqliteStorageRepositories } from "./sqliteStorageRepositories";
import type { SqlExecutor, SqlPreparedStatement, SqlQueryResult, SqlResult, SqlValue } from "./sqlExecutor";

interface RecordedCall {
  sql: string;
  values: SqlValue[];
  method: "first" | "all" | "run";
}

class FakeStatement implements SqlPreparedStatement {
  private values: SqlValue[] = [];

  constructor(
    private readonly sql: string,
    private readonly calls: RecordedCall[],
    private readonly firstRows: Record<string, unknown>[],
    private readonly allRows: Record<string, unknown>[]
  ) {}

  bind(...values: SqlValue[]): SqlPreparedStatement {
    this.values = values;
    return this;
  }

  async first<Row = Record<string, unknown>>(): Promise<Row | null> {
    this.calls.push({ sql: this.sql, values: this.values, method: "first" });
    return (this.firstRows.shift() as Row | undefined) ?? null;
  }

  async all<Row = Record<string, unknown>>(): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql: this.sql, values: this.values, method: "all" });
    return { results: this.allRows.splice(0) as Row[] };
  }

  async run(): Promise<SqlResult> {
    this.calls.push({ sql: this.sql, values: this.values, method: "run" });
    return { success: true };
  }
}

class FakeExecutor implements SqlExecutor {
  readonly calls: RecordedCall[] = [];
  readonly firstRows: Record<string, unknown>[] = [];
  readonly allRows: Record<string, unknown>[] = [];

  prepare(sql: string): SqlPreparedStatement {
    return new FakeStatement(sql, this.calls, this.firstRows, this.allRows);
  }
}

describe("createSqliteStorageRepositories", () => {
  it("writes words using the migration column names and JSON list fields", async () => {
    const db = new FakeExecutor();
    const repositories = createSqliteStorageRepositories(db);

    await repositories.words.upsertWord({
      id: "word_1",
      word: "手机",
      wordNormalized: "手机",
      aliases: ["智能手机"],
      categories: ["电子产品"],
      tags: ["可携带"],
      difficulty: "easy",
      enabled: true
    });

    expect(db.calls[0]?.method).toBe("run");
    expect(db.calls[0]?.sql).toContain("INSERT INTO words");
    expect(db.calls[0]?.sql).toContain("word_normalized");
    expect(db.calls[0]?.values).toEqual([
      "word_1",
      "手机",
      "手机",
      "[\"智能手机\"]",
      "[\"电子产品\"]",
      "[\"可携带\"]",
      "easy",
      1,
      null,
      null
    ]);
  });

  it("maps nullable and boolean values from rows without exposing SQL shapes", async () => {
    const db = new FakeExecutor();
    db.firstRows.push({
      id: "guess_1",
      game_id: "game_1",
      visitor_id: "visitor_1",
      guess_raw: " 电话 ",
      guess_normalized: "电话",
      score: null,
      ai_score: 76,
      relation_type: "synonym",
      reason: null,
      source: "model",
      counted: 1,
      reject_reason: null,
      was_rule_adjusted: 0,
      created_at: "2026-05-17T00:00:00.000Z"
    });

    const repositories = createSqliteStorageRepositories(db);
    const guess = await repositories.guesses.findCountedGuessByGameAndNormalized("game_1", "电话");

    expect(db.calls[0]?.sql).toContain("counted = 1");
    expect(db.calls[0]?.values).toEqual(["game_1", "电话"]);
    expect(guess).toEqual({
      id: "guess_1",
      gameId: "game_1",
      visitorId: "visitor_1",
      guessRaw: " 电话 ",
      guessNormalized: "电话",
      score: null,
      aiScore: 76,
      relationType: "synonym",
      reason: null,
      source: "model",
      counted: true,
      rejectReason: null,
      wasRuleAdjusted: false,
      createdAt: "2026-05-17T00:00:00.000Z"
    });
  });

  it("queries score cache by the documented identity fields and records hits", async () => {
    const db = new FakeExecutor();
    db.firstRows.push({
      cache_key: "cache_1",
      answer_id: "word_1",
      guess_normalized: "电话",
      rule_version: "scoring-v0.1",
      provider: "deepseek",
      model_name: "deepseek-v4-flash",
      thinking_mode: "disabled",
      score: 76,
      ai_score: null,
      relation_type: "synonym",
      reason: "接近通讯工具",
      created_at: "2026-05-17T00:00:00.000Z",
      hit_count: 2,
      last_hit_at: null
    });

    const repositories = createSqliteStorageRepositories(db);
    const entry = await repositories.scoreCache.findScoreCache({
      answerId: "word_1",
      guessNormalized: "电话",
      ruleVersion: "scoring-v0.1",
      modelName: "deepseek-v4-flash",
      thinkingMode: "disabled"
    });
    await repositories.scoreCache.recordScoreCacheHit("cache_1", "2026-05-17T00:01:00.000Z");

    expect(db.calls[0]?.sql).toContain("answer_id = ?");
    expect(db.calls[0]?.values).toEqual(["word_1", "电话", "scoring-v0.1", "deepseek-v4-flash", "disabled"]);
    expect(entry?.hitCount).toBe(2);
    expect(entry?.lastHitAt).toBeNull();
    expect(db.calls[1]?.sql).toContain("hit_count = hit_count + 1");
    expect(db.calls[1]?.values).toEqual(["2026-05-17T00:01:00.000Z", "cache_1"]);
  });

  it("keeps AI call logs as minimal mirrors and preserves nullable gateway fields", async () => {
    const db = new FakeExecutor();
    const repositories = createSqliteStorageRepositories(db);

    await repositories.aiCallLogs.createAiCallLog({
      id: "log_1",
      gameId: "game_1",
      provider: "deepseek",
      modelName: "deepseek-v4-flash",
      thinkingMode: "disabled",
      ruleVersion: "scoring-v0.1",
      latencyMs: 123,
      status: "success",
      cacheStatus: null,
      estimatedCostUsd: null
    });

    expect(db.calls[0]?.sql).toContain("INSERT INTO ai_call_logs");
    expect(db.calls[0]?.values).toEqual([
      "log_1",
      "game_1",
      null,
      "deepseek",
      "deepseek-v4-flash",
      "disabled",
      null,
      null,
      null,
      "scoring-v0.1",
      null,
      null,
      null,
      123,
      null,
      "success",
      null,
      null,
      null
    ]);
  });
});
