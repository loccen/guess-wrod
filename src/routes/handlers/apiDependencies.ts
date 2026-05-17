import { FailingCaptchaVerifier, BypassCaptchaVerifier } from "../../infrastructure/adapters/bypassCaptchaVerifier";
import { CryptoIdGenerator } from "../../infrastructure/adapters/cryptoIdGenerator";
import { MathRandomSource } from "../../infrastructure/adapters/mathRandomSource";
import { loadAppConfig, type RuntimeEnv } from "../../infrastructure/adapters/runtimeConfig";
import { SignedSessionTokenService } from "../../infrastructure/adapters/sessionTokenService";
import { Sha256ValueHasher } from "../../infrastructure/adapters/sha256ValueHasher";
import { SystemClock } from "../../infrastructure/adapters/systemClock";
import type { AppServices } from "../../usecases/services/platformPorts";
import { createStorageRepositories, type StorageBindings } from "./storage/createStorageRepositories";

export interface ApiRuntimeEnv extends RuntimeEnv, StorageBindings {
  SESSION_TOKEN_SECRET?: string;
}

const LOCAL_DEV_SESSION_TOKEN_SECRET = "guess-wrod-local-dev-secret";

export function createAppServices(env: ApiRuntimeEnv): AppServices {
  const config = loadAppConfig(env);
  const clock = new SystemClock();

  return {
    storage: createStorageRepositories(env),
    clock,
    idGenerator: new CryptoIdGenerator(),
    randomSource: new MathRandomSource(),
    sessionTokenService: new SignedSessionTokenService(env.SESSION_TOKEN_SECRET ?? LOCAL_DEV_SESSION_TOKEN_SECRET),
    captchaVerifier:
      config.captchaMode === "bypass"
        ? new BypassCaptchaVerifier(() => clock.now().toISOString())
        : new FailingCaptchaVerifier(),
    valueHasher: new Sha256ValueHasher()
  };
}
