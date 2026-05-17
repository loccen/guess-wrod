import { ApiError, SESSION_TTL_MS } from "../../domain/models/api";
import type { Session } from "../../domain/models/storage";
import type { AppServices } from "./platformPorts";

export interface AuthenticatedSession {
  session: Session;
  visitorId: string;
}

export interface CreateAnonymousSessionInput {
  clientTimezone?: string | null;
  turnstileToken?: string | null;
  userAgent?: string | null;
}

export interface CreateAnonymousSessionResult {
  visitorId: string;
  sessionToken: string;
  expiresAt: string;
}

export interface CurrentSessionResult {
  visitorId: string;
  expiresAt: string;
  activeGameId: string | null;
}

function plusMilliseconds(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

function ensureNotExpired(expiresAt: string, now: Date): void {
  if (new Date(expiresAt).getTime() <= now.getTime()) {
    throw new ApiError({
      code: "unauthorized",
      status: 401,
      message: "会话已过期。"
    });
  }
}

function ensureSessionActive(session: Session, now: Date): void {
  if (session.revokedAt) {
    throw new ApiError({
      code: "unauthorized",
      status: 401,
      message: "会话已失效。"
    });
  }

  ensureNotExpired(session.expiresAt, now);
}

export class SessionService {
  constructor(private readonly services: AppServices) {}

  async createAnonymousSession(input: CreateAnonymousSessionInput): Promise<CreateAnonymousSessionResult> {
    const captchaResult = await this.services.captchaVerifier.verify({
      token: input.turnstileToken
    });
    if (!captchaResult.ok) {
      throw new ApiError({
        code: captchaResult.code,
        status: captchaResult.code === "turnstile_required" ? 403 : 400,
        message: captchaResult.message
      });
    }

    const now = this.services.clock.now();
    const expiresAt = plusMilliseconds(now, SESSION_TTL_MS).toISOString();
    const visitorId = this.services.idGenerator.next("visitor");
    const sessionId = this.services.idGenerator.next("session");
    const sessionToken = await this.services.sessionTokenService.issue({
      sessionId,
      visitorId,
      expiresAt
    });
    const sessionTokenHash = await this.services.sessionTokenService.hash(sessionToken);
    const userAgentHash = input.userAgent ? await this.services.valueHasher.hash(input.userAgent) : null;
    const nowIso = now.toISOString();

    await this.services.storage.sessions.upsertVisitor({
      id: visitorId,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      userAgentHash
    });
    await this.services.storage.sessions.createSession({
      id: sessionId,
      visitorId,
      sessionTokenHash,
      expiresAt,
      createdAt: nowIso,
      turnstilePassedAt: captchaResult.passedAt
    });

    return {
      visitorId,
      sessionToken,
      expiresAt
    };
  }

  async authenticate(authorizationHeader: string | null): Promise<AuthenticatedSession> {
    const token = readBearerToken(authorizationHeader);
    const claims = await this.services.sessionTokenService.verify(token);
    if (!claims) {
      throw new ApiError({
        code: "unauthorized",
        status: 401,
        message: "会话 token 无效。"
      });
    }

    const now = this.services.clock.now();
    ensureNotExpired(claims.expiresAt, now);

    const sessionTokenHash = await this.services.sessionTokenService.hash(token);
    const session = await this.services.storage.sessions.findSessionByTokenHash(sessionTokenHash);
    if (!session || session.id !== claims.sessionId || session.visitorId !== claims.visitorId) {
      throw new ApiError({
        code: "unauthorized",
        status: 401,
        message: "会话不存在。"
      });
    }

    ensureSessionActive(session, now);
    await this.services.storage.sessions.touchVisitor(session.visitorId, now.toISOString());

    return {
      session,
      visitorId: session.visitorId
    };
  }

  async getCurrentSession(authorizationHeader: string | null): Promise<CurrentSessionResult> {
    const authenticated = await this.authenticate(authorizationHeader);
    const activeGames = await this.services.storage.games.listGamesByVisitor(authenticated.visitorId, {
      status: "playing",
      limit: 1
    });

    return {
      visitorId: authenticated.visitorId,
      expiresAt: authenticated.session.expiresAt,
      activeGameId: activeGames[0]?.id ?? null
    };
  }
}

export function readBearerToken(authorizationHeader: string | null): string {
  const header = authorizationHeader?.trim();
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError({
      code: "unauthorized",
      status: 401,
      message: "缺少会话凭证。"
    });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError({
      code: "unauthorized",
      status: 401,
      message: "缺少会话凭证。"
    });
  }

  return token;
}
