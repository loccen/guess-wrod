import { createAppServices, type ApiRuntimeEnv } from "../../src/routes/handlers/apiDependencies";
import { getSessionResponse } from "../../src/routes/handlers/sessionHandlers";

export const onRequestGet: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return getSessionResponse(request, createAppServices(env));
};
