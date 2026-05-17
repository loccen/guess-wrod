import { createAppServices, type ApiRuntimeEnv } from "../../../../src/routes/handlers/apiDependencies";
import { submitGuessResponse } from "../../../../src/routes/handlers/gameHandlers";

export const onRequestPost: PagesFunction<ApiRuntimeEnv> = async ({ env, request, params }) => {
  return submitGuessResponse(request, createAppServices(env), String(params.game_id));
};
