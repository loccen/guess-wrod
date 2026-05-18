import type { AppConfig } from "./appConfig";

export interface RuntimeVersionInfo {
  version: string;
  source: "cf_pages_commit_sha" | "git_commit_sha" | "build_id" | "runtime_version" | "unknown";
}

export interface AiRuntimeConfigSummary {
  hasAiGatewayEndpoint: boolean;
  hasAiGatewayApiKey: boolean;
  hasAiGatewayByokAlias: boolean;
}

export interface CaptchaRuntimeConfigSummary {
  hasTurnstileSiteKey: boolean;
  turnstileSiteKey: string | null;
}

export interface HealthStatus {
  service: "guess-wrod-api";
  status: "ok";
  timestamp: string;
  modes: AppConfig;
  runtime: RuntimeVersionInfo;
  aiRuntime: AiRuntimeConfigSummary;
  captchaRuntime: CaptchaRuntimeConfigSummary;
}
