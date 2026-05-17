export type AnalyticsValue = string | number | boolean | null;

export type AnalyticsEventName =
  | "session_created"
  | "game_created"
  | "guess_submitted"
  | "guess_reused"
  | "game_success"
  | "game_give_up"
  | "game_expired"
  | "score_feedback_submitted"
  | "ai_error";

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  eventTime: string;
  visitorIdHash: string;
  sessionId: string | null;
  page: string;
  gameId: string | null;
  answerId: string | null;
  guessId: string | null;
  modelName: string | null;
  ruleVersion: string | null;
  payload: Record<string, AnalyticsValue>;
}

export type ArchiveStream = "guess_events" | "ai_call_logs";

export interface ArchiveRecord {
  stream: ArchiveStream;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface ArchiveWriteResult {
  objectKey: string | null;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): Promise<void>;
}

export interface ArchiveSink {
  append(record: ArchiveRecord): Promise<ArchiveWriteResult>;
}
