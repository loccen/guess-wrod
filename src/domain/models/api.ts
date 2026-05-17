export type ApiErrorCode =
  | "unauthorized"
  | "turnstile_required"
  | "turnstile_failed"
  | "game_not_found"
  | "game_ended"
  | "invalid_request"
  | "invalid_guess"
  | "sensitive_word"
  | "ai_timeout"
  | "rate_limited"
  | "system_error";

export interface ApiErrorOptions {
  code: ApiErrorCode;
  status: number;
  message: string;
  counted?: boolean;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly counted: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.counted = options.counted ?? false;
  }
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const GAME_TTL_MS = 24 * 60 * 60 * 1000;
export const GAME_MAX_GUESSES = 100;
export const DEFAULT_RULE_VERSION = "v0.1";
export const DEFAULT_MODEL_NAME = "deepseek-v4-flash";
export const DEFAULT_THINKING_MODE = "disabled";
