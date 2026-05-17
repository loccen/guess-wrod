import { describe, expect, it, vi } from "vitest";
import { LiveCaptchaVerifier } from "./liveCaptchaVerifier";

describe("LiveCaptchaVerifier", () => {
  it("returns required when token is missing", async () => {
    const verifier = new LiveCaptchaVerifier({ secret: "s", fetch: vi.fn() as unknown as typeof fetch });
    await expect(verifier.verify({ token: null })).resolves.toMatchObject({ ok: false, code: "turnstile_required" });
  });

  it("returns ok when turnstile success is true", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) })) as unknown as typeof fetch;
    const verifier = new LiveCaptchaVerifier({ secret: "s", fetch: fetchMock }, () => "2026-01-01T00:00:00.000Z");
    await expect(verifier.verify({ token: "t" })).resolves.toEqual({ ok: true, passedAt: "2026-01-01T00:00:00.000Z" });
  });
});
