import { DEFAULT_MODEL_NAME, DEFAULT_THINKING_MODE } from "../../domain/models/api";
import { ArchiveMirroringAnalyticsSink } from "../../infrastructure/adapters/archiveMirroringAnalyticsSink";
import { DeepSeekAiGatewayScoringClient } from "../../infrastructure/adapters/deepseekAiGatewayScoringClient";
import { LiveCaptchaVerifier } from "../../infrastructure/adapters/liveCaptchaVerifier";
import { LiveAnalyticsSink, LiveArchiveSink } from "../../infrastructure/adapters/liveObservabilitySinks";
import { NoopAnalyticsSink, NoopArchiveSink } from "../../infrastructure/adapters/noopObservabilitySinks";
import { LocalSensitiveTermChecker } from "../../infrastructure/adapters/sensitiveTerms";
import { FailingCaptchaVerifier, BypassCaptchaVerifier } from "../../infrastructure/adapters/bypassCaptchaVerifier";
import { CryptoIdGenerator } from "../../infrastructure/adapters/cryptoIdGenerator";
import { MathRandomSource } from "../../infrastructure/adapters/mathRandomSource";
import { loadAppConfig, type RuntimeEnv } from "../../infrastructure/adapters/runtimeConfig";
import { SignedSessionTokenService } from "../../infrastructure/adapters/sessionTokenService";
import { Sha256ValueHasher } from "../../infrastructure/adapters/sha256ValueHasher";
import { SystemClock } from "../../infrastructure/adapters/systemClock";
import { StubScoringClient } from "../../infrastructure/adapters/stubScoringClient";
import { ScoringGateway } from "../../usecases/scoring/scoringGateway";
import type { AppServices, ScoringProfile } from "../../usecases/services/platformPorts";
import { createStorageRepositories, type StorageBindings } from "./storage/createStorageRepositories";

export interface ApiRuntimeEnv extends RuntimeEnv, StorageBindings {
  SESSION_TOKEN_SECRET?: string;
  AI_GATEWAY_ENDPOINT_URL?: string;
  AI_GATEWAY_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  AI_MODEL_NAME?: string;
  AI_THINKING_MODE?: string;
}

const LOCAL_DEV_SESSION_TOKEN_SECRET = "guess-wrod-local-dev-secret";

function resolveScoringProfile(env: ApiRuntimeEnv, aiMode: "stub" | "live"): ScoringProfile {
  return {
    provider: aiMode === "live" ? "deepseek" : "stub",
    modelName: env.AI_MODEL_NAME?.trim() || DEFAULT_MODEL_NAME,
    thinkingMode: env.AI_THINKING_MODE === "enabled" ? "enabled" : DEFAULT_THINKING_MODE
  };
}

export function createAppServices(env: ApiRuntimeEnv): AppServices {
  const config = loadAppConfig(env);
  const clock = new SystemClock();
  const scoringProfile = resolveScoringProfile(env, config.aiMode);
  const archiveSink =
    config.archiveMode === "live" ? new LiveArchiveSink() : new NoopArchiveSink();
  const scoringClient =
    config.aiMode === "live"
      ? new DeepSeekAiGatewayScoringClient({
          endpointUrl: requiredEnv(env.AI_GATEWAY_ENDPOINT_URL, "AI_GATEWAY_ENDPOINT_URL"),
          apiKey: optionalEnv(env.AI_GATEWAY_API_KEY),
          model: scoringProfile.modelName
        })
      : new StubScoringClient();

  return {
    storage: createStorageRepositories(env),
    clock,
    idGenerator: new CryptoIdGenerator(),
    randomSource: new MathRandomSource(),
    sessionTokenService: new SignedSessionTokenService(env.SESSION_TOKEN_SECRET ?? LOCAL_DEV_SESSION_TOKEN_SECRET),
    captchaVerifier:
      config.captchaMode === "bypass"
        ? new BypassCaptchaVerifier(() => clock.now().toISOString())
        : env.TURNSTILE_SECRET_KEY
          ? new LiveCaptchaVerifier({ secret: env.TURNSTILE_SECRET_KEY }, () => clock.now().toISOString())
          : new FailingCaptchaVerifier(),
    valueHasher: new Sha256ValueHasher(),
    sensitiveTermChecker: new LocalSensitiveTermChecker(),
    scoringGateway: new ScoringGateway(scoringClient),
    scoringProfile,
    analyticsSink:
      config.analyticsMode === "live"
        ? config.archiveMode === "live"
          ? new LiveAnalyticsSink()
          : new ArchiveMirroringAnalyticsSink(archiveSink)
        : new NoopAnalyticsSink(),
    archiveSink
  };
}

function optionalEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredEnv(value: string | undefined, name: string): string {
  if (value && value.trim().length > 0) {
    return value;
  }

  throw new Error(`${name} is required when AI_MODE=live.`);
}
