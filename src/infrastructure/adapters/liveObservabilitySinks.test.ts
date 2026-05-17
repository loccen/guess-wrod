import { describe, expect, it, vi } from "vitest";
import { LiveAnalyticsSink, LiveArchiveSink } from "./liveObservabilitySinks";

describe("Live observability sinks", () => {
  it("returns object key for archive append", async () => {
    const sink = new LiveArchiveSink();
    const result = await sink.append({
      stream: "guess_events",
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: { a: 1 }
    });
    expect(result.objectKey).toBe("guess_events/2026-01-01T00:00:00.000Z");
  });

  it("tracks analytics without throwing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const sink = new LiveAnalyticsSink();
    await expect(
      sink.track({
        eventName: "session_created",
        eventTime: "2026-01-01T00:00:00.000Z",
        visitorIdHash: "v",
        sessionId: null,
        page: "/",
        gameId: null,
        answerId: null,
        guessId: null,
        modelName: null,
        ruleVersion: null,
        payload: {}
      })
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
