import { createHealthResponse } from "../../src/routes/handlers/healthHandler";
import type { RuntimeEnv } from "../../src/infrastructure/adapters/runtimeConfig";

export const onRequestGet: PagesFunction<RuntimeEnv> = async ({ env }) => {
  return createHealthResponse(env);
};
