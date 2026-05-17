import { createAppServices, type ApiRuntimeEnv } from "../../../src/routes/handlers/apiDependencies";
import { createGameResponse } from "../../../src/routes/handlers/gameHandlers";

export const onRequestPost: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return createGameResponse(request, createAppServices(env));
};
