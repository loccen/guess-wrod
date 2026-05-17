import {
  RELATION_SCORE_CAPS,
  SCORING_ERROR_CODES,
  SCORING_RULES_VERSION,
  findLocalExactMatch,
  postProcessAiScoringOutput,
  type AiPostProcessedScore,
  type RelationType,
  type ScoringError,
} from "../../domain/scoring/index.mjs";

export interface ScoringGatewayRequest {
  answer: string;
  aliases?: string[];
  guess: string;
  language?: string;
}

export interface AiScoringRequest {
  answer: string;
  guess: string;
  language: string;
  scoringRulesVersion: string;
  relationCaps: Partial<Record<RelationType, number>>;
}

export interface AiScoringClient {
  score(request: AiScoringRequest): Promise<unknown>;
}

export interface ScoringGatewayOptions {
  maxAttempts?: number;
}

export type ScoringGatewayResult =
  | {
      ok: true;
      value: {
        score: number;
        relationType: RelationType;
        isExact: boolean;
        source: "exact_match" | "ai";
        counted: true;
        guessNormalized: string;
        attempts: number;
        ai?: AiPostProcessedScore;
      };
    }
  | {
      ok: false;
      error: ScoringError & {
        attempts: number;
        source: "validation" | "ai";
      };
    };

const DEFAULT_LANGUAGE = "zh-CN";
const DEFAULT_MAX_ATTEMPTS = 2;
const AI_RETRYABLE_ERROR_CODES = new Set<string>([
  SCORING_ERROR_CODES.INVALID_JSON,
  SCORING_ERROR_CODES.MISSING_SCORE,
  SCORING_ERROR_CODES.INVALID_SCORE,
  SCORING_ERROR_CODES.MISSING_RELATION_TYPE,
  SCORING_ERROR_CODES.INVALID_RELATION_TYPE,
  SCORING_ERROR_CODES.AI_EXACT_WITHOUT_LOCAL_MATCH,
]);

export class ScoringGateway {
  private readonly maxAttempts: number;

  constructor(
    private readonly aiClient: AiScoringClient,
    options: ScoringGatewayOptions = {},
  ) {
    this.maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  }

  async score(request: ScoringGatewayRequest): Promise<ScoringGatewayResult> {
    const localMatch = findLocalExactMatch({
      answer: request.answer,
      aliases: request.aliases ?? [],
      guess: request.guess,
    });

    if (!localMatch.ok) {
      return {
        ok: false,
        error: {
          ...localMatch.error,
          attempts: 0,
          source: "validation",
        },
      };
    }

    if (localMatch.matched) {
      return {
        ok: true,
        value: {
          score: localMatch.score,
          relationType: localMatch.relationType,
          isExact: localMatch.isExact,
          source: "exact_match",
          counted: localMatch.counted,
          guessNormalized: localMatch.guessNormalized,
          attempts: 0,
        },
      };
    }

    const aiRequest: AiScoringRequest = {
      answer: request.answer,
      guess: localMatch.guessNormalized,
      language: request.language ?? DEFAULT_LANGUAGE,
      scoringRulesVersion: SCORING_RULES_VERSION,
      relationCaps: RELATION_SCORE_CAPS,
    };

    let lastError: ScoringError | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const rawScore = await this.aiClient.score(aiRequest);
      const processedScore = postProcessAiScoringOutput(rawScore, { localExactMatch: false });

      if (processedScore.ok) {
        return {
          ok: true,
          value: {
            score: processedScore.value.score,
            relationType: processedScore.value.relationType,
            isExact: processedScore.value.isExact,
            source: "ai",
            counted: true,
            guessNormalized: localMatch.guessNormalized,
            attempts: attempt,
            ai: processedScore.value,
          },
        };
      }

      lastError = processedScore.error;
      if (!shouldRetryAiScoringError(processedScore.error) || attempt === this.maxAttempts) {
        return {
          ok: false,
          error: {
            ...processedScore.error,
            retryable: shouldRetryAiScoringError(processedScore.error),
            attempts: attempt,
            source: "ai",
          },
        };
      }
    }

    return {
      ok: false,
      error: {
        code: "ai_scoring_failed",
        message: lastError?.message ?? "AI scoring failed.",
        retryable: false,
        attempts: this.maxAttempts,
        source: "ai",
        details: lastError,
      },
    };
  }
}

export function shouldRetryAiScoringError(error: Pick<ScoringError, "code" | "retryable">): boolean {
  return error.retryable && AI_RETRYABLE_ERROR_CODES.has(error.code);
}
