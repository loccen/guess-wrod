import type { AppConfig } from "../../domain/models/appConfig";
import type { AiRuntimeConfigSummary, HealthStatus, RuntimeVersionInfo } from "../../domain/models/health";

export function getHealthStatus(
  config: AppConfig,
  runtime: RuntimeVersionInfo,
  aiRuntime: AiRuntimeConfigSummary,
  now = new Date()
): HealthStatus {
  return {
    service: "guess-wrod-api",
    status: "ok",
    timestamp: now.toISOString(),
    modes: config,
    runtime,
    aiRuntime
  };
}
