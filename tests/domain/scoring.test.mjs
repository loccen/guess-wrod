import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RELATION_SCORE_CAPS,
  RELATION_TYPES,
  SCORING_ERROR_CODES,
  findLocalExactMatch,
  getRelationScoreCap,
  normalizeGuess,
  postProcessAiScoringOutput,
  validateScoringSample,
} from "../../src/domain/scoring/index.mjs";

test("normalizes trim, full-width characters, and latin case", () => {
  assert.deepEqual(normalizeGuess("  ＡＢＣ１２３　").value, "abc123");
});

test("keeps emoji as valid input", () => {
  assert.deepEqual(normalizeGuess(" 📱 ").value, "📱");
});

test("rejects empty values and control-only values", () => {
  assert.equal(normalizeGuess("   ").error.code, SCORING_ERROR_CODES.EMPTY_INPUT);
  assert.equal(normalizeGuess("\u0000\u0007").error.code, SCORING_ERROR_CODES.CONTROL_ONLY);
});

test("rejects normalized values longer than configured limit", () => {
  assert.equal(normalizeGuess("一二三四五六七八九十一二三四五六七八九十一").error.code, SCORING_ERROR_CODES.TOO_LONG);
});

test("exposes complete relation caps", () => {
  assert.equal(RELATION_TYPES.length, Object.keys(RELATION_SCORE_CAPS).length);
  assert.equal(getRelationScoreCap("synonym"), 95);
  assert.equal(getRelationScoreCap("invalid"), 0);
  assert.equal(getRelationScoreCap("missing"), undefined);
});

test("uses local exact match before any AI score", () => {
  const result = findLocalExactMatch({
    answer: "手机",
    aliases: ["智能手机", "移动电话", "📱"],
    guess: " 手機 ",
  });

  assert.equal(result.matched, false);

  const exactResult = findLocalExactMatch({
    answer: "iPhone",
    aliases: ["苹果手机"],
    guess: "ＩＰＨＯＮＥ",
  });

  assert.equal(exactResult.matched, true);
  assert.equal(exactResult.relationType, "exact");
  assert.equal(exactResult.score, 100);
});

test("uses local aliases, including emoji aliases", () => {
  const aliasResult = findLocalExactMatch({
    answer: "手机",
    aliases: ["智能手机", "移动电话", "📱"],
    guess: "📱",
  });

  assert.equal(aliasResult.matched, true);
  assert.equal(aliasResult.relationType, "alias");
  assert.equal(aliasResult.score, 100);
});

test("post-processes score bounds and relation caps", () => {
  const result = postProcessAiScoringOutput({
    score: 999,
    relation_type: "weak_context",
    is_exact: false,
    confidence: 1.2,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.score, 55);
  assert.equal(result.value.confidence, 1);
  assert.equal(result.value.wasRuleAdjusted, true);
  assert.deepEqual(result.value.adjustments.map((item) => item.type), ["score_bounds", "relation_cap"]);
});

test("rounds numeric string score and clips low values", () => {
  const result = postProcessAiScoringOutput({
    score: "-2.4",
    relation_type: "unrelated",
    is_exact: false,
  });

  assert.equal(result.value.score, 0);
});

test("returns retryable errors for invalid AI relation and score", () => {
  assert.equal(
    postProcessAiScoringOutput({ score: 20, relation_type: "nearby" }).error.code,
    SCORING_ERROR_CODES.INVALID_RELATION_TYPE,
  );

  assert.equal(
    postProcessAiScoringOutput({ score: "high", relation_type: "synonym" }).error.code,
    SCORING_ERROR_CODES.INVALID_SCORE,
  );
});

test("does not accept AI exact or alias without local dictionary match", () => {
  const result = postProcessAiScoringOutput({
    score: 100,
    relation_type: "exact",
    is_exact: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, SCORING_ERROR_CODES.AI_EXACT_WITHOUT_LOCAL_MATCH);
  assert.equal(result.error.retryable, true);
});

test("records AI exact claim without making it a local exact match", () => {
  const result = postProcessAiScoringOutput({
    score: 92,
    relation_type: "synonym",
    is_exact: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.aiClaimedExact, true);
  assert.equal(result.value.isExact, false);
  assert.equal(result.value.score, 92);
});

test("parses JSON string model output", () => {
  const result = postProcessAiScoringOutput('{"score":72,"relation_type":"service_context","is_exact":false}');

  assert.equal(result.ok, true);
  assert.equal(result.value.score, 72);
  assert.equal(result.value.relationType, "service_context");
});

test("validates manual scoring samples and relation caps", async () => {
  const content = await readFile(new URL("../../data/scoring-samples.json", import.meta.url), "utf8");
  const samples = JSON.parse(content);

  assert.ok(samples.length >= RELATION_TYPES.length);

  const coveredRelations = new Set();
  for (const sample of samples) {
    const result = validateScoringSample(sample);
    assert.equal(result.ok, true, `${sample.answer}/${sample.guess}: ${result.error?.message ?? ""}`);
    coveredRelations.add(sample.expected_relation_type);
  }

  for (const relationType of RELATION_TYPES) {
    assert.equal(coveredRelations.has(relationType), true, `missing ${relationType}`);
  }
});
