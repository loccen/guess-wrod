import { FeedbackService } from "../../usecases/services/feedbackService";
import { GameService } from "../../usecases/services/gameService";
import { GuessService } from "../../usecases/services/guessService";
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

export async function listGameHistoryResponse(request: Request, services: AppServices): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "", 10);
    const pageSize = Number.parseInt(url.searchParams.get("page_size") ?? "", 10);
    const result = await gameService.listGameHistory(authenticated, {
      page: Number.isNaN(page) ? null : page,
      pageSize: Number.isNaN(pageSize) ? null : pageSize
    });

    return createDataResponse({
      items: result.items.map((item) => ({
        game_id: item.gameId,
        status: item.status,
        guess_count: item.guessCount,
        started_at: item.startedAt,
        ended_at: item.endedAt,
        ...(item.expireReason ? { expire_reason: item.expireReason } : {}),
        best_guess: item.bestGuess
          ? {
              guess_id: item.bestGuess.guessId,
              guess: item.bestGuess.guess,
              score: item.bestGuess.score
            }
          : null
      })),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
      has_more: result.hasMore
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
      ...(result.expireReason ? { expire_reason: result.expireReason } : {}),
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

export async function deleteGameHistoryResponse(request: Request, services: AppServices, gameId: string): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const result = await gameService.deleteHistoryGame(authenticated, gameId);

    return createDataResponse({
      success: result.success
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

export async function submitGuessResponse(request: Request, services: AppServices, gameId: string): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const guessService = new GuessService(services);
    const result = await guessService.submitGuess(authenticated, gameId, {
      guess: body.guess
    });

    return createDataResponse({
      guess_id: result.guessId,
      guess: result.guess,
      normalized_guess: result.normalizedGuess,
      score: result.score,
      relation_type: result.relationType,
      is_exact: result.isExact,
      status: result.status,
      source: result.source,
      counted: result.counted,
      guess_count: result.guessCount,
      ...(result.expireReason ? { expire_reason: result.expireReason } : {}),
      best_guess: result.bestGuess
        ? {
            guess_id: result.bestGuess.guessId,
            guess: result.bestGuess.guess,
            score: result.bestGuess.score
          }
        : null,
      ...(result.answer ? { answer: result.answer } : {})
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function submitFeedbackResponse(request: Request, services: AppServices, gameId: string): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const feedbackService = new FeedbackService(services);
    const result = await feedbackService.submitFeedback(authenticated, gameId, {
      guessId: body.guess_id,
      feedbackType: body.feedback_type,
      note: body.note
    });

    return createDataResponse({
      success: result.success
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function clearGameHistoryResponse(request: Request, services: AppServices): Promise<Response> {
  try {
    const sessionService = new SessionService(services);
    const authenticated = await sessionService.authenticate(request.headers.get("authorization"));
    const gameService = new GameService(services);
    const result = await gameService.clearGameHistory(authenticated);

    return createDataResponse({
      success: result.success,
      deleted_count: result.deletedCount
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
