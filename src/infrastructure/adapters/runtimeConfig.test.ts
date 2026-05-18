import { describe, expect, it } from "vitest";
import { loadAiRuntimeConfigSummary, loadAppConfig, loadCaptchaRuntimeConfigSummary, loadRuntimeVersion } from "./runtimeConfig";

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

  it("returns non-secret boolean flags for ai gateway runtime config", () => {
    expect(
      loadAiRuntimeConfigSummary({
        AI_GATEWAY_ENDPOINT: "https://gateway.ai.cloudflare.com/v1/demo/guess-word",
        AI_GATEWAY_API_KEY: "token-value",
        AI_GATEWAY_BYOK_ALIAS: "production"
      })
    ).toEqual({
      hasAiGatewayEndpoint: true,
      hasAiGatewayApiKey: true,
      hasAiGatewayByokAlias: true
    });

    expect(
      loadAiRuntimeConfigSummary({
        AI_GATEWAY_ENDPOINT: " ",
        AI_GATEWAY_API_KEY: "",
        AI_GATEWAY_BYOK_ALIAS: undefined
      })
    ).toEqual({
      hasAiGatewayEndpoint: false,
      hasAiGatewayApiKey: false,
      hasAiGatewayByokAlias: false
    });
  });

  it("returns public turnstile site key summary", () => {
    expect(
      loadCaptchaRuntimeConfigSummary({
        TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
      })
    ).toEqual({
      hasTurnstileSiteKey: true,
      turnstileSiteKey: "1x00000000000000000000AA"
    });

    expect(
      loadCaptchaRuntimeConfigSummary({
        TURNSTILE_SITE_KEY: "  "
      })
    ).toEqual({
      hasTurnstileSiteKey: false,
      turnstileSiteKey: null
    });
  });
});
