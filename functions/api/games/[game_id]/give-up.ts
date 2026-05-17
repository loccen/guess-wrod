import { createAppServices, type ApiRuntimeEnv } from "../../../../src/routes/handlers/apiDependencies";
import { giveUpGameResponse } from "../../../../src/routes/handlers/gameHandlers";

export const onRequestPost: PagesFunction<ApiRuntimeEnv> = async ({ env, request, params }) => {
  return giveUpGameResponse(request, createAppServices(env), String(params.game_id));
};
