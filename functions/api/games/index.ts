import { createAppServices, type ApiRuntimeEnv } from "../../../src/routes/handlers/apiDependencies";
import { clearGameHistoryResponse, createGameResponse, listGameHistoryResponse } from "../../../src/routes/handlers/gameHandlers";

export const onRequestPost: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return createGameResponse(request, createAppServices(env));
};

export const onRequestGet: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return listGameHistoryResponse(request, createAppServices(env));
};

export const onRequestDelete: PagesFunction<ApiRuntimeEnv> = async ({ env, request }) => {
  return clearGameHistoryResponse(request, createAppServices(env));
};
