export type AiMode = "stub" | "live";
export type CaptchaMode = "bypass" | "live";
export type AnalyticsMode = "noop" | "live";
export type ArchiveMode = "file" | "live";

export interface AppConfig {
  aiMode: AiMode;
  captchaMode: CaptchaMode;
  analyticsMode: AnalyticsMode;
  archiveMode: ArchiveMode;
}
