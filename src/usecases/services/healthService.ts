import type { AppConfig } from "../../domain/models/appConfig";
import type { HealthStatus } from "../../domain/models/health";

export function getHealthStatus(config: AppConfig, now = new Date()): HealthStatus {
  return {
    service: "guess-wrod-api",
    status: "ok",
    timestamp: now.toISOString(),
    modes: config
  };
}
