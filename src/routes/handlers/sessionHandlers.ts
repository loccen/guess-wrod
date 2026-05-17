import { SessionService } from "../../usecases/services/sessionService";
import type { AppServices } from "../../usecases/services/platformPorts";
import { createDataResponse, createErrorResponse } from "./apiResponse";

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength === "0") {
    return {};
  }

  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function createSessionResponse(request: Request, services: AppServices): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const sessionService = new SessionService(services);
    const result = await sessionService.createAnonymousSession({
      clientTimezone: typeof body.client_timezone === "string" ? body.client_timezone : null,
      turnstileToken: typeof body.turnstile_token === "string" ? body.turnstile_token : null,
      userAgent: request.headers.get("user-agent")
    });

    return createDataResponse({
      visitor_id: result.visitorId,
      session_token: result.sessionToken,
      expires_at: result.expiresAt
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function getSessionResponse(request: Request, services: AppServices): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const result = await sessionService.getCurrentSession(request.headers.get("authorization"));

    return createDataResponse({
      visitor_id: result.visitorId,
      expires_at: result.expiresAt,
      active_game_id: result.activeGameId
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
