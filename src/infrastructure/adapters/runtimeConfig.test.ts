import { describe, expect, it } from "vitest";
import { loadAppConfig, loadRuntimeVersion } from "./runtimeConfig";

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

  it("extracts a safe runtime version from commit/build markers", () => {
    expect(loadRuntimeVersion({ CF_PAGES_COMMIT_SHA: "ABCDEF1234567890" })).toEqual({
      version: "abcdef123456",
      source: "cf_pages_commit_sha"
    });

    expect(loadRuntimeVersion({ BUILD_ID: "build@2026/05/18#prod" })).toEqual({
      version: "build_2026_05_18_prod",
      source: "build_id"
    });

    expect(loadRuntimeVersion({})).toEqual({
      version: "unknown",
      source: "unknown"
    });
  });
});
