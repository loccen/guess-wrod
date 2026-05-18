import { createAppServices, type ApiRuntimeEnv } from "../../../src/routes/handlers/apiDependencies";
import { deleteGameHistoryResponse, getGameResponse } from "../../../src/routes/handlers/gameHandlers";

export const onRequestGet: PagesFunction<ApiRuntimeEnv> = async ({ env, request, params }) => {
  return getGameResponse(request, createAppServices(env), String(params.game_id));
};

export const onRequestDelete: PagesFunction<ApiRuntimeEnv> = async ({ env, request, params }) => {
  return deleteGameHistoryResponse(request, createAppServices(env), String(params.game_id));
};
