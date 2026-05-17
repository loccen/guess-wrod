import type { NewAiCallLog } from "../../domain/models/storage";
import type { AnalyticsEvent, AnalyticsEventName, AnalyticsValue } from "../ports/observability";
import type { AppServices } from "./platformPorts";

export interface TrackEventInput {
  eventName: AnalyticsEventName;
  eventTime?: string;
  visitorId: string;
  sessionId: string | null;
  page: string;
  gameId?: string | null;
  answerId?: string | null;
  guessId?: string | null;
  modelName?: string | null;
  ruleVersion?: string | null;
  payload?: Record<string, AnalyticsValue>;
}

export class ObservabilityService {
  constructor(private readonly services: AppServices) {}

  async trackEvent(input: TrackEventInput): Promise<void> {
    try {
      const event = await this.toAnalyticsEvent(input);
      await this.services.analyticsSink.track(event);
    } catch {}
  }

  async recordAiCall(log: NewAiCallLog): Promise<void> {
    let archiveObjectKey: string | null = null;

    try {
      const archiveResult = await this.services.archiveSink.append({
        stream: "ai_call_logs",
        createdAt: log.createdAt ?? this.services.clock.now().toISOString(),
        payload: {
          id: log.id,
          game_id: log.gameId,
          guess_id: log.guessId ?? null,
          provider: log.provider,
          model_name: log.modelName,
          thinking_mode: log.thinkingMode,
          gateway_slug: log.gatewaySlug ?? null,
          gateway_request_id: log.gatewayRequestId ?? null,
          provider_request_id: log.providerRequestId ?? null,
          rule_version: log.ruleVersion,
          input_tokens: log.inputTokens ?? null,
          output_tokens: log.outputTokens ?? null,
          cache_status: log.cacheStatus ?? null,
          latency_ms: log.latencyMs,
          estimated_cost_usd: log.estimatedCostUsd ?? null,
          status: log.status,
          error_code: log.errorCode ?? null
        }
      });
      archiveObjectKey = archiveResult.objectKey;
    } catch {}

    try {
      await this.services.storage.aiCallLogs.createAiCallLog({
        ...log,
        archiveObjectKey
      });
    } catch {}
  }

  private async toAnalyticsEvent(input: TrackEventInput): Promise<AnalyticsEvent> {
    return {
      eventName: input.eventName,
      eventTime: input.eventTime ?? this.services.clock.now().toISOString(),
      visitorIdHash: await this.services.valueHasher.hash(input.visitorId),
      sessionId: input.sessionId,
      page: input.page,
      gameId: input.gameId ?? null,
      answerId: input.answerId ?? null,
      guessId: input.guessId ?? null,
      modelName: input.modelName ?? null,
      ruleVersion: input.ruleVersion ?? null,
      payload: input.payload ?? {}
    };
  }
}
