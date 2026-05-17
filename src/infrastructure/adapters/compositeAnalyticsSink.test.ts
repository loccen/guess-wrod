import { describe, expect, it } from "vitest";
import type { AnalyticsEvent, AnalyticsSink } from "../../usecases/ports/observability";
import { ArchiveMirroringAnalyticsSink } from "./archiveMirroringAnalyticsSink";
import { CompositeAnalyticsSink } from "./compositeAnalyticsSink";
import { LiveAnalyticsSink } from "./liveObservabilitySinks";

class RecordingArchiveSink {
  records: Array<{ stream: string; payload: Record<string, unknown> }> = [];

  async append(record: { stream: "guess_events" | "ai_call_logs"; createdAt: string; payload: Record<string, unknown> }) {
    this.records.push({ stream: record.stream, payload: record.payload });
    return { objectKey: `${record.stream}/1` };
  }
}

class RecordingAnalyticsSink implements AnalyticsSink {
  events: AnalyticsEvent[] = [];

  async track(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("CompositeAnalyticsSink", () => {
  it("writes event to live analytics and mirrored archive sink", async () => {
    const live = new RecordingAnalyticsSink();
    const archive = new RecordingArchiveSink();
    const sink = new CompositeAnalyticsSink([live, new ArchiveMirroringAnalyticsSink(archive)]);
    const event: AnalyticsEvent = {
      eventName: "guess_submitted",
      eventTime: "2026-01-01T00:00:00.000Z",
      visitorIdHash: "v",
      sessionId: "s",
      page: "/game",
      gameId: "g",
      answerId: "a",
      guessId: "x",
      modelName: "m",
      ruleVersion: "r",
      payload: { score: 88 }
    };

    await sink.track(event);

    expect(live.events).toHaveLength(1);
    expect(archive.records).toHaveLength(1);
    expect(archive.records[0]?.stream).toBe("guess_events");
    expect(archive.records[0]?.payload.event_name).toBe("guess_submitted");
  });

  it("can include live analytics sink in composition", async () => {
    const archive = new RecordingArchiveSink();
    const sink = new CompositeAnalyticsSink([new LiveAnalyticsSink(), new ArchiveMirroringAnalyticsSink(archive)]);
    await sink.track({
      eventName: "session_created",
      eventTime: "2026-01-01T00:00:00.000Z",
      visitorIdHash: "v",
      sessionId: "s",
      page: "/",
      gameId: null,
      answerId: null,
      guessId: null,
      modelName: null,
      ruleVersion: null,
      payload: {}
    });
    expect(archive.records).toHaveLength(1);
  });
});
