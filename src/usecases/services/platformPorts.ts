import type { ThinkingMode } from "../../domain/models/storage";
import type { StorageRepositories } from "../repositories/storageRepositories";
import type { ScoringGateway } from "../scoring/scoringGateway";

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export interface RandomSource {
  next(): number;
}

export interface SessionTokenClaims {
  sessionId: string;
  visitorId: string;
  expiresAt: string;
}

export interface SessionTokenService {
  issue(claims: SessionTokenClaims): Promise<string>;
  verify(token: string): Promise<SessionTokenClaims | null>;
  hash(token: string): Promise<string>;
}

export type CaptchaVerificationResult =
  | {
      ok: true;
      passedAt: string;
    }
  | {
      ok: false;
      code: "turnstile_required" | "turnstile_failed";
      message: string;
    };

export interface CaptchaVerifier {
  verify(input: { token?: string | null }): Promise<CaptchaVerificationResult>;
}

export interface ValueHasher {
  hash(value: string): Promise<string>;
}

export interface SensitiveTermChecker {
  matches(normalizedText: string): boolean;
}

export interface ScoringProfile {
  provider: string;
  modelName: string;
  thinkingMode: ThinkingMode;
}

export interface AppServices {
  storage: StorageRepositories;
  clock: Clock;
  idGenerator: IdGenerator;
  randomSource: RandomSource;
  sessionTokenService: SessionTokenService;
  captchaVerifier: CaptchaVerifier;
  valueHasher: ValueHasher;
  sensitiveTermChecker: SensitiveTermChecker;
  scoringGateway: ScoringGateway;
  scoringProfile: ScoringProfile;
}
