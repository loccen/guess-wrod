export const SCORING_RULES_VERSION: "v0.1";

export const SCORING_LIMITS: Readonly<{
  minLength: number;
  maxLength: number;
}>;

export const RELATION_TYPES: readonly [
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
];

export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_SCORE_CAPS: Readonly<Record<RelationType, number>>;

export const SCORING_ERROR_CODES: Readonly<{
  NOT_STRING: "not_string";
  EMPTY_INPUT: "empty_input";
  CONTROL_ONLY: "control_only";
  TOO_LONG: "too_long";
  INVALID_JSON: "invalid_json";
  MISSING_SCORE: "missing_score";
  INVALID_SCORE: "invalid_score";
  MISSING_RELATION_TYPE: "missing_relation_type";
  INVALID_RELATION_TYPE: "invalid_relation_type";
  AI_EXACT_WITHOUT_LOCAL_MATCH: "ai_exact_without_local_match";
}>;

export interface ScoringError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ScoringError };

export type NormalizeResult =
  | { ok: true; value: string; original: string }
  | { ok: false; error: ScoringError };

export interface LocalExactMatch {
  ok: true;
  matched: true;
  score: 100;
  relationType: "exact" | "alias";
  isExact: true;
  source: "exact_match";
  counted: true;
  guessNormalized: string;
}

export interface LocalExactMiss {
  ok: true;
  matched: false;
  guessNormalized: string;
}

export type LocalExactMatchResult = LocalExactMatch | LocalExactMiss | { ok: false; error: ScoringError };

export interface AiPostProcessedScore {
  score: number;
  rawScore: unknown;
  relationType: RelationType;
  isExact: boolean;
  aiClaimedExact: boolean;
  confidence?: number;
  wasRuleAdjusted: boolean;
  adjustments: Array<Record<string, unknown>>;
}

export function normalizeGuess(input: unknown): NormalizeResult;
export function normalizeRequiredText(input: unknown, fieldName?: string): NormalizeResult;
export function isRelationType(value: unknown): value is RelationType;
export function getRelationScoreCap(relationType: unknown): number | undefined;
export function findLocalExactMatch(input: {
  guess: unknown;
  answer: unknown;
  aliases?: unknown[];
}): LocalExactMatchResult;
export function parseAiScoringOutput(rawOutput: unknown): Result<unknown>;
export function postProcessAiScoringOutput(rawOutput: unknown, options?: { localExactMatch?: boolean }): Result<AiPostProcessedScore>;
export function validateScoringSample(sample: Record<string, unknown>): Result<Record<string, unknown>>;
