import { describe, expect, it } from "vitest";
import { SignedSessionTokenService } from "./sessionTokenService";

describe("SignedSessionTokenService", () => {
  it("issues tokens that can be verified and hashed", async () => {
    const service = new SignedSessionTokenService("test-secret");
    const token = await service.issue({
      sessionId: "session_1",
      visitorId: "visitor_1",
      expiresAt: "2026-06-17T00:00:00.000Z"
    });

    const claims = await service.verify(token);
    const hash = await service.hash(token);

    expect(claims).toEqual({
      sessionId: "session_1",
      visitorId: "visitor_1",
      expiresAt: "2026-06-17T00:00:00.000Z"
    });
    expect(hash).toHaveLength(64);
  });

  it("rejects tampered tokens", async () => {
    const service = new SignedSessionTokenService("test-secret");
    const token = await service.issue({
      sessionId: "session_1",
      visitorId: "visitor_1",
      expiresAt: "2026-06-17T00:00:00.000Z"
    });

    const tampered = `${token}x`;
    expect(await service.verify(tampered)).toBeNull();
  });
});
