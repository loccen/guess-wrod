import type { AnalyticsEvent, AnalyticsSink, ArchiveSink } from "../../usecases/ports/observability";

export class ArchiveMirroringAnalyticsSink implements AnalyticsSink {
  constructor(private readonly archiveSink: ArchiveSink) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await this.archiveSink.append({
      stream: "guess_events",
      createdAt: event.eventTime,
      payload: {
        event_name: event.eventName,
        event_time: event.eventTime,
        visitor_id_hash: event.visitorIdHash,
        session_id: event.sessionId,
        page: event.page,
        game_id: event.gameId,
        answer_id: event.answerId,
        guess_id: event.guessId,
        model_name: event.modelName,
        rule_version: event.ruleVersion,
        ...event.payload
      }
    });
  }
}
