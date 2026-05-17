import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./healthService";

describe("getHealthStatus", () => {
  it("returns a platform-neutral health payload", () => {
    const status = getHealthStatus(
      {
        aiMode: "stub",
        captchaMode: "bypass",
        analyticsMode: "noop",
        archiveMode: "file"
      },
      {
        version: "abcdef123456",
        source: "cf_pages_commit_sha"
      },
      new Date("2026-05-17T00:00:00.000Z")
    );

    expect(status).toEqual({
      service: "guess-wrod-api",
      status: "ok",
      timestamp: "2026-05-17T00:00:00.000Z",
      modes: {
        aiMode: "stub",
        captchaMode: "bypass",
        analyticsMode: "noop",
        archiveMode: "file"
      },
      runtime: {
        version: "abcdef123456",
        source: "cf_pages_commit_sha"
      }
    });
  });
});
