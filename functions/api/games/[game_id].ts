import { createAppServices, type ApiRuntimeEnv } from "../../../src/routes/handlers/apiDependencies";
import { getGameResponse } from "../../../src/routes/handlers/gameHandlers";

export const onRequestGet: PagesFunction<ApiRuntimeEnv> = async ({ env, request, params }) => {
  return getGameResponse(request, createAppServices(env), String(params.game_id));
};
