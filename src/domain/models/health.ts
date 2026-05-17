import type { AppConfig } from "./appConfig";

export interface HealthStatus {
  service: "guess-wrod-api";
  status: "ok";
  timestamp: string;
  modes: AppConfig;
}
