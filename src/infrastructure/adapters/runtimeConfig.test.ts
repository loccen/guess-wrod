import { describe, expect, it } from "vitest";
import { loadAppConfig } from "./runtimeConfig";

describe("loadAppConfig", () => {
  it("uses local development defaults when env is empty", () => {
    expect(loadAppConfig()).toEqual({
      aiMode: "stub",
      captchaMode: "bypass",
      analyticsMode: "noop",
      archiveMode: "file"
    });
  });

  it("accepts live mode values from the runtime adapter boundary", () => {
    expect(
      loadAppConfig({
        AI_MODE: "live",
        CAPTCHA_MODE: "live",
        ANALYTICS_MODE: "live",
        ARCHIVE_MODE: "live"
      })
    ).toEqual({
      aiMode: "live",
      captchaMode: "live",
      analyticsMode: "live",
      archiveMode: "live"
    });
  });
});
