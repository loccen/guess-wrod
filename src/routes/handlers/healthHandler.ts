import { loadAiRuntimeConfigSummary, loadAppConfig, loadRuntimeVersion, type RuntimeEnv } from "../../infrastructure/adapters/runtimeConfig";
import { getHealthStatus } from "../../usecases/services/healthService";

export function createHealthResponse(env: RuntimeEnv): Response {
  return Response.json({
    data: getHealthStatus(loadAppConfig(env), loadRuntimeVersion(env), loadAiRuntimeConfigSummary(env))
  });
}
