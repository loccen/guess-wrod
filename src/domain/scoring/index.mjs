export const SCORING_RULES_VERSION = "v0.2";

export const SCORING_LIMITS = Object.freeze({
  minLength: 1,
  maxLength: 20,
});

export const RELATION_TYPES = Object.freeze([
  "exact",
  "alias",
  "synonym",
  "parent_category",
  "same_category",
  "attribute",
  "function",
  "component",
  "accessory",
  "service_context",
  "usage_context",
  "weak_context",
  "unrelated",
  "invalid",
]);

export const RELATION_SCORE_CAPS = Object.freeze({
  exact: 100,
  alias: 100,
  synonym: 95,
  parent_category: 80,
  same_category: 85,
  attribute: 82,
  function: 80,
  component: 82,
  accessory: 78,
  service_context: 78,
  usage_context: 75,
  weak_context: 55,
  unrelated: 25,
  invalid: 0,
});

export const SCORING_ERROR_CODES = Object.freeze({
  NOT_STRING: "not_string",
  EMPTY_INPUT: "empty_input",
  CONTROL_ONLY: "control_only",
  TOO_LONG: "too_long",
  INVALID_JSON: "invalid_json",
  MISSING_SCORE: "missing_score",
  INVALID_SCORE: "invalid_score",
  MISSING_RELATION_TYPE: "missing_relation_type",
  INVALID_RELATION_TYPE: "invalid_relation_type",
  AI_EXACT_WITHOUT_LOCAL_MATCH: "ai_exact_without_local_match",
});

const CONTROL_OR_FORMAT_RE = /[\p{Cc}\p{Cf}]/gu;
const NON_CONTROL_OR_FORMAT_RE = /[^\p{Cc}\p{Cf}]/u;
const LOCAL_EXACT_RELATIONS = new Set(["exact", "alias"]);

export function normalizeGuess(input) {
  if (typeof input !== "string") {
    return failure(SCORING_ERROR_CODES.NOT_STRING, "Guess must be a string.");
  }

  const trimmed = input.trim();
  const normalized = trimmed.normalize("NFKC").toLocaleLowerCase("und");

  if (normalized.length === 0) {
    return failure(SCORING_ERROR_CODES.EMPTY_INPUT, "Guess is empty after normalization.");
  }

  if (!NON_CONTROL_OR_FORMAT_RE.test(normalized)) {
    return failure(SCORING_ERROR_CODES.CONTROL_ONLY, "Guess contains only control or format characters.");
  }

  const visibleValue = normalized.replace(CONTROL_OR_FORMAT_RE, "");
  if (visibleValue.length === 0) {
    return failure(SCORING_ERROR_CODES.EMPTY_INPUT, "Guess is empty after removing control characters.");
  }

  if (visibleValue.length > SCORING_LIMITS.maxLength) {
    return failure(SCORING_ERROR_CODES.TOO_LONG, "Guess is longer than the configured limit.", {
      maxLength: SCORING_LIMITS.maxLength,
      actualLength: visibleValue.length,
    });
  }

  return {
    ok: true,
    value: visibleValue,
    original: input,
  };
}

export function normalizeRequiredText(input, fieldName = "value") {
  const result = normalizeGuess(input);
  if (!result.ok) {
    return failure(result.error.code, `${fieldName}: ${result.error.message}`, result.error.details);
  }

  return result;
}

export function isRelationType(value) {
  return typeof value === "string" && RELATION_TYPES.includes(value);
}

export function getRelationScoreCap(relationType) {
  if (!isRelationType(relationType)) {
    return undefined;
  }

  return RELATION_SCORE_CAPS[relationType];
}

export function findLocalExactMatch({ guess, answer, aliases = [] }) {
  const guessResult = normalizeGuess(guess);
  if (!guessResult.ok) {
    return guessResult;
  }

  const answerResult = normalizeRequiredText(answer, "answer");
  if (!answerResult.ok) {
    return answerResult;
  }

  if (guessResult.value === answerResult.value) {
    return localScore("exact", guessResult.value);
  }

  for (const alias of aliases) {
    const aliasResult = normalizeRequiredText(alias, "alias");
    if (!aliasResult.ok) {
      continue;
    }

    if (guessResult.value === aliasResult.value) {
      return localScore("alias", guessResult.value);
    }
  }

  return {
    ok: true,
    matched: false,
    guessNormalized: guessResult.value,
  };
}

export function parseAiScoringOutput(rawOutput) {
  if (typeof rawOutput === "string") {
    try {
      return { ok: true, value: JSON.parse(rawOutput) };
    } catch {
      return retryableFailure(SCORING_ERROR_CODES.INVALID_JSON, "AI output is not valid JSON.");
    }
  }

  if (rawOutput && typeof rawOutput === "object" && !Array.isArray(rawOutput)) {
    return { ok: true, value: rawOutput };
  }

  return retryableFailure(SCORING_ERROR_CODES.INVALID_JSON, "AI output must be an object or JSON object string.");
}

export function postProcessAiScoringOutput(rawOutput, options = {}) {
  const parsed = parseAiScoringOutput(rawOutput);
  if (!parsed.ok) {
    return parsed;
  }

  const output = parsed.value;
  if (!Object.hasOwn(output, "score")) {
    return retryableFailure(SCORING_ERROR_CODES.MISSING_SCORE, "AI output misses score.");
  }

  if (!Object.hasOwn(output, "relation_type")) {
    return retryableFailure(SCORING_ERROR_CODES.MISSING_RELATION_TYPE, "AI output misses relation_type.");
  }

  if (!isRelationType(output.relation_type)) {
    return retryableFailure(SCORING_ERROR_CODES.INVALID_RELATION_TYPE, "AI output relation_type is not supported.", {
      relationType: output.relation_type,
    });
  }

  if (!options.localExactMatch && LOCAL_EXACT_RELATIONS.has(output.relation_type)) {
    return retryableFailure(
      SCORING_ERROR_CODES.AI_EXACT_WITHOUT_LOCAL_MATCH,
      "AI cannot produce exact or alias without a local dictionary match.",
      { relationType: output.relation_type },
    );
  }

  const numericScore = Number(output.score);
  if (!Number.isFinite(numericScore)) {
    return retryableFailure(SCORING_ERROR_CODES.INVALID_SCORE, "AI output score is not a finite number.");
  }

  const roundedScore = Math.round(numericScore);
  const boundedScore = clamp(roundedScore, 0, 100);
  const relationCap = RELATION_SCORE_CAPS[output.relation_type];
  const finalScore = Math.min(boundedScore, relationCap);

  return {
    ok: true,
    value: {
      score: finalScore,
      rawScore: output.score,
      relationType: output.relation_type,
      isExact: Boolean(options.localExactMatch),
      aiClaimedExact: output.is_exact === true,
      reason: normalizeReason(output.reason),
      confidence: normalizeConfidence(output.confidence),
      wasRuleAdjusted: finalScore !== roundedScore,
      adjustments: buildAdjustments(roundedScore, boundedScore, finalScore, relationCap),
    },
  };
}

export function validateScoringSample(sample) {
  const requiredFields = [
    "answer",
    "guess",
    "expected_relation_type",
    "expected_score_min",
    "expected_score_max",
  ];

  for (const field of requiredFields) {
    if (!Object.hasOwn(sample, field)) {
      return failure("missing_sample_field", `Sample misses ${field}.`, { field });
    }
  }

  if (!isRelationType(sample.expected_relation_type)) {
    return failure(SCORING_ERROR_CODES.INVALID_RELATION_TYPE, "Sample relation_type is not supported.", {
      relationType: sample.expected_relation_type,
    });
  }

  const min = Number(sample.expected_score_min);
  const max = Number(sample.expected_score_max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) {
    return failure("invalid_sample_score_range", "Sample score range must be integer values from 0 to 100.", {
      min: sample.expected_score_min,
      max: sample.expected_score_max,
    });
  }

  const cap = RELATION_SCORE_CAPS[sample.expected_relation_type];
  if (max > cap) {
    return failure("sample_exceeds_relation_cap", "Sample score range exceeds relation cap.", {
      relationType: sample.expected_relation_type,
      cap,
      max,
    });
  }

  return { ok: true, value: sample };
}

function localScore(relationType, guessNormalized) {
  return {
    ok: true,
    matched: true,
    score: 100,
    relationType,
    isExact: true,
    source: "exact_match",
    counted: true,
    guessNormalized,
  };
}

function normalizeConfidence(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  return clamp(numericValue, 0, 1);
}

function normalizeReason(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function buildAdjustments(roundedScore, boundedScore, finalScore, relationCap) {
  const adjustments = [];

  if (boundedScore !== roundedScore) {
    adjustments.push({
      type: "score_bounds",
      from: roundedScore,
      to: boundedScore,
    });
  }

  if (finalScore !== boundedScore) {
    adjustments.push({
      type: "relation_cap",
      cap: relationCap,
      from: boundedScore,
      to: finalScore,
    });
  }

  return adjustments;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function failure(code, message, details = undefined) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: false,
      details,
    },
  };
}

function retryableFailure(code, message, details = undefined) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: true,
      details,
    },
  };
}
