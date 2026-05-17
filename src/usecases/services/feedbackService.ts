import { ApiError } from "../../domain/models/api";
import type { FeedbackType, Game, Guess } from "../../domain/models/storage";
import { ObservabilityService } from "./observabilityService";
import type { AppServices } from "./platformPorts";
import type { AuthenticatedSession } from "./sessionService";

const MAX_FEEDBACK_NOTE_LENGTH = 200;

export interface SubmitScoreFeedbackInput {
  guessId: unknown;
  feedbackType: unknown;
  note?: unknown;
}

export interface SubmitScoreFeedbackResult {
  feedbackId: string;
  success: true;
  createdAt: string;
}

function parseGuessId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError({
      code: "invalid_request",
      status: 400,
      message: "guess_id 不能为空。"
    });
  }

  return value.trim();
}

function parseFeedbackType(value: unknown): FeedbackType {
  if (value !== "score_unreasonable") {
    throw new ApiError({
      code: "invalid_request",
      status: 400,
      message: "当前只支持 score_unreasonable 反馈。"
    });
  }

  return value;
}

function parseNote(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError({
      code: "invalid_request",
      status: 400,
      message: "note 必须是字符串。"
    });
  }

  const note = value.trim();
  if (note.length === 0) {
    return null;
  }

  if (note.length > MAX_FEEDBACK_NOTE_LENGTH) {
    throw new ApiError({
      code: "invalid_request",
      status: 400,
      message: `note 不能超过 ${MAX_FEEDBACK_NOTE_LENGTH} 个字符。`
    });
  }

  return note;
}

export class FeedbackService {
  constructor(private readonly services: AppServices) {}

  async submitFeedback(
    session: AuthenticatedSession,
    gameId: string,
    input: SubmitScoreFeedbackInput
  ): Promise<SubmitScoreFeedbackResult> {
    const observability = new ObservabilityService(this.services);
    const game = await this.readOwnedGame(session.visitorId, gameId);
    if (game.status !== "playing") {
      throw new ApiError({
        code: "game_ended",
        status: 409,
        message: "当前游戏已结束。"
      });
    }

    const guessId = parseGuessId(input.guessId);
    const feedbackType = parseFeedbackType(input.feedbackType);
    const note = parseNote(input.note);
    const guess = await this.readOwnedGuess(session.visitorId, game.id, guessId);

    if (!guess.counted || guess.score === null) {
      throw new ApiError({
        code: "invalid_request",
        status: 400,
        message: "当前猜词不支持提交评分反馈。"
      });
    }

    const existingFeedback = await this.services.storage.feedback.listFeedbackByGuess(guess.id, { limit: 20 });
    if (existingFeedback.some((item) => item.visitorId === session.visitorId && item.feedbackType === feedbackType)) {
      throw new ApiError({
        code: "invalid_request",
        status: 400,
        message: "该猜词已经提交过相同反馈。"
      });
    }

    const createdAt = this.services.clock.now().toISOString();
    const feedbackId = this.services.idGenerator.next("feedback");

    await this.services.storage.feedback.createFeedback({
      id: feedbackId,
      gameId: game.id,
      guessId: guess.id,
      visitorId: session.visitorId,
      feedbackType,
      note,
      createdAt
    });
    await observability.trackEvent({
      eventName: "score_feedback_submitted",
      eventTime: createdAt,
      visitorId: session.visitorId,
      sessionId: session.session.id,
      page: "feedback",
      gameId: game.id,
      answerId: game.answerId,
      guessId: guess.id,
      modelName: game.modelName,
      ruleVersion: game.ruleVersion,
      payload: {
        feedback_type: feedbackType,
        score: guess.score,
        relation_type: guess.relationType,
        note_present: note !== null
      }
    });

    return {
      feedbackId,
      success: true,
      createdAt
    };
  }

  private async readOwnedGame(visitorId: string, gameId: string): Promise<Game> {
    const game = await this.services.storage.games.findGameById(gameId);
    if (!game || game.visitorId !== visitorId) {
      throw new ApiError({
        code: "game_not_found",
        status: 404,
        message: "游戏不存在。"
      });
    }

    return game;
  }

  private async readOwnedGuess(visitorId: string, gameId: string, guessId: string): Promise<Guess> {
    const guess = await this.services.storage.guesses.findGuessById(guessId);
    if (!guess || guess.visitorId !== visitorId || guess.gameId !== gameId) {
      throw new ApiError({
        code: "invalid_request",
        status: 400,
        message: "guess_id 与当前游戏不匹配。"
      });
    }

    return guess;
  }
}
