import { GameService } from "../../usecases/services/gameService";
import type { AppServices } from "../../usecases/services/platformPorts";
import { SessionService } from "../../usecases/services/sessionService";
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

export async function createGameResponse(request: Request, services: AppServices): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const result = await gameService.createGame(authenticated, {
      mode: typeof body.mode === "string" ? body.mode : null
    });

    return createDataResponse({
      game_id: result.gameId,
      mode: result.mode,
      status: result.status,
      guess_count: result.guessCount,
      started_at: result.startedAt,
      expires_at: result.expiresAt
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function getGameResponse(request: Request, services: AppServices, gameId: string): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const result = await gameService.getGameStatus(authenticated, gameId);

    return createDataResponse({
      game_id: result.gameId,
      status: result.status,
      guess_count: result.guessCount,
      best_guess: result.bestGuess
        ? {
            guess_id: result.bestGuess.guessId,
            guess: result.bestGuess.guess,
            score: result.bestGuess.score
          }
        : null,
      guesses: result.guesses.map((guess) => ({
        guess_id: guess.guessId,
        guess: guess.guess,
        score: guess.score,
        relation_type: guess.relationType,
        source: guess.source,
        counted: guess.counted,
        created_at: guess.createdAt
      })),
      started_at: result.startedAt,
      ended_at: result.endedAt,
      ...(result.answer
        ? {
            answer: result.answer,
            answer_aliases: result.answerAliases ?? []
          }
        : {})
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function giveUpGameResponse(request: Request, services: AppServices, gameId: string): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const result = await gameService.giveUpGame(authenticated, gameId);

    return createDataResponse({
      game_id: result.gameId,
      status: result.status,
      answer: result.answer,
      guess_count: result.guessCount,
      ended_at: result.endedAt
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
