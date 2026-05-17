import type { SessionTokenClaims, SessionTokenService } from "../../usecases/services/platformPorts";

interface SessionTokenPayload extends SessionTokenClaims {
  version: 1;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256(secret: Uint8Array, content: string): Promise<string> {
  const secretBytes = secret.slice();
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return encodeBase64Url(new Uint8Array(signature));
}

async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export class SignedSessionTokenService implements SessionTokenService {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async issue(claims: SessionTokenClaims): Promise<string> {
    const payload: SessionTokenPayload = {
      version: 1,
      sessionId: claims.sessionId,
      visitorId: claims.visitorId,
      expiresAt: claims.expiresAt
    };
    const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const content = `gw1.${encodedPayload}`;
    const signature = await hmacSha256(this.secret, content);
    return `${content}.${signature}`;
  }

  async verify(token: string): Promise<SessionTokenClaims | null> {
    const [prefix, payloadPart, signature] = token.split(".");
    if (prefix !== "gw1" || !payloadPart || !signature) {
      return null;
    }

    const expectedSignature = await hmacSha256(this.secret, `gw1.${payloadPart}`);
    if (!timingSafeEqual(expectedSignature, signature)) {
      return null;
    }

    try {
      const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart))) as Partial<SessionTokenPayload>;
      if (
        payload.version !== 1 ||
        typeof payload.sessionId !== "string" ||
        typeof payload.visitorId !== "string" ||
        typeof payload.expiresAt !== "string"
      ) {
        return null;
      }

      return {
        sessionId: payload.sessionId,
        visitorId: payload.visitorId,
        expiresAt: payload.expiresAt
      };
    } catch {
      return null;
    }
  }

  hash(token: string): Promise<string> {
    return sha256(token);
  }
}
