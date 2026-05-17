export type IsoDateTimeString = string;

export type WordDifficulty = "easy" | "normal" | "hard";
export type GameStatus = "playing" | "success" | "give_up" | "expired";
export type ThinkingMode = "disabled" | "enabled";
export type GuessSource = "exact_match" | "game_cache" | "global_cache" | "model" | "fallback";
export type GameExpireReason = "guess_limit" | "ttl";
export type FeedbackType = "score_unreasonable";
export type AiCacheStatus = "hit" | "miss" | "bypass";
export type AiCallStatus = "success" | "timeout" | "error" | "invalid_json";

export interface Visitor {
  id: string;
  createdAt: IsoDateTimeString;
  lastSeenAt: IsoDateTimeString;
  userAgentHash: string | null;
}

export interface Session {
  id: string;
  visitorId: string;
  sessionTokenHash: string;
  expiresAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
  revokedAt: IsoDateTimeString | null;
  turnstilePassedAt: IsoDateTimeString | null;
}

export interface Word {
  id: string;
  word: string;
  wordNormalized: string;
  aliases: string[];
  categories: string[];
  tags: string[];
  difficulty: WordDifficulty;
  enabled: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface Game {
  id: string;
  visitorId: string;
  answerId: string;
  status: GameStatus;
  ruleVersion: string;
  modelName: string;
  thinkingMode: ThinkingMode;
  guessCount: number;
  bestGuessId: string | null;
  startedAt: IsoDateTimeString;
  endedAt: IsoDateTimeString | null;
  expiresAt: IsoDateTimeString | null;
  expireReason: GameExpireReason | null;
}

export interface Guess {
  id: string;
  gameId: string;
  visitorId: string;
  guessRaw: string;
  guessNormalized: string;
  score: number | null;
  aiScore: number | null;
  relationType: string | null;
  reason: string | null;
  source: GuessSource;
  counted: boolean;
  rejectReason: string | null;
  wasRuleAdjusted: boolean;
  createdAt: IsoDateTimeString;
}

export interface ScoreCacheEntry {
  cacheKey: string;
  answerId: string;
  guessNormalized: string;
  ruleVersion: string;
  provider: string;
  modelName: string;
  thinkingMode: ThinkingMode;
  score: number;
  aiScore: number | null;
  relationType: string;
  reason: string | null;
  createdAt: IsoDateTimeString;
  hitCount: number;
  lastHitAt: IsoDateTimeString | null;
}

export interface ScoreFeedback {
  id: string;
  gameId: string;
  guessId: string;
  visitorId: string;
  feedbackType: FeedbackType;
  note: string | null;
  createdAt: IsoDateTimeString;
}

export interface AiCallLog {
  id: string;
  gameId: string;
  guessId: string | null;
  provider: string;
  modelName: string;
  thinkingMode: ThinkingMode;
  gatewaySlug: string | null;
  gatewayRequestId: string | null;
  providerRequestId: string | null;
  ruleVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheStatus: AiCacheStatus | null;
  latencyMs: number;
  estimatedCostUsd: number | null;
  status: AiCallStatus;
  errorCode: string | null;
  responseStatus: number | null;
  requestUrl: string | null;
  requestPath: string | null;
  responseSummaryPrefix: string | null;
  hasGatewayAuth: boolean | null;
  hasByokAlias: boolean | null;
  archiveObjectKey: string | null;
  createdAt: IsoDateTimeString;
}

export type NewVisitor = Pick<Visitor, "id" | "userAgentHash"> & Partial<Pick<Visitor, "createdAt" | "lastSeenAt">>;
export type NewSession = Pick<Session, "id" | "visitorId" | "sessionTokenHash" | "expiresAt"> &
  Partial<Pick<Session, "createdAt" | "revokedAt" | "turnstilePassedAt">>;
export type NewWord = Pick<
  Word,
  "id" | "word" | "wordNormalized" | "aliases" | "categories" | "tags" | "difficulty" | "enabled"
> &
  Partial<Pick<Word, "createdAt" | "updatedAt">>;
export type NewGame = Pick<
  Game,
  "id" | "visitorId" | "answerId" | "status" | "ruleVersion" | "modelName" | "thinkingMode"
> &
  Partial<Pick<Game, "guessCount" | "bestGuessId" | "startedAt" | "endedAt" | "expiresAt" | "expireReason">>;
export type NewGuess = Pick<
  Guess,
  | "id"
  | "gameId"
  | "visitorId"
  | "guessRaw"
  | "guessNormalized"
  | "source"
  | "counted"
  | "wasRuleAdjusted"
> &
  Partial<Pick<Guess, "score" | "aiScore" | "relationType" | "reason" | "rejectReason" | "createdAt">>;
export type NewScoreCacheEntry = Pick<
  ScoreCacheEntry,
  | "cacheKey"
  | "answerId"
  | "guessNormalized"
  | "ruleVersion"
  | "provider"
  | "modelName"
  | "thinkingMode"
  | "score"
  | "relationType"
> &
  Partial<Pick<ScoreCacheEntry, "aiScore" | "reason" | "createdAt" | "hitCount" | "lastHitAt">>;
export type NewScoreFeedback = Pick<ScoreFeedback, "id" | "gameId" | "guessId" | "visitorId" | "feedbackType"> &
  Partial<Pick<ScoreFeedback, "note" | "createdAt">>;
export type NewAiCallLog = Pick<
  AiCallLog,
  "id" | "gameId" | "provider" | "modelName" | "thinkingMode" | "ruleVersion" | "latencyMs" | "status"
> &
  Partial<
    Pick<
      AiCallLog,
      | "guessId"
      | "gatewaySlug"
      | "gatewayRequestId"
      | "providerRequestId"
      | "inputTokens"
      | "outputTokens"
      | "cacheStatus"
      | "estimatedCostUsd"
      | "errorCode"
      | "responseStatus"
      | "requestUrl"
      | "requestPath"
      | "responseSummaryPrefix"
      | "hasGatewayAuth"
      | "hasByokAlias"
      | "archiveObjectKey"
      | "createdAt"
    >
  >;
