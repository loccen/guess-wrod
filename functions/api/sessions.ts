import { createAppServices, type ApiRuntimeEnv } from "../../src/routes/handlers/apiDependencies";
import { createSessionResponse } from "../../src/routes/handlers/sessionHandlers";

export const onRequestPost: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return createSessionResponse(request, createAppServices(env));
};
