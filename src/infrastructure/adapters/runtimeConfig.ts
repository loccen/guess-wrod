import type {
  AiMode,
  AnalyticsMode,
  AppConfig,
  ArchiveMode,
  CaptchaMode
} from "../../domain/models/appConfig";

export interface RuntimeEnv {
  AI_MODE?: string;
  CAPTCHA_MODE?: string;
  ANALYTICS_MODE?: string;
  ARCHIVE_MODE?: string;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  return fallback;
}

export function loadAppConfig(env: RuntimeEnv = {}): AppConfig {
  return {
    aiMode: oneOf<AiMode>(env.AI_MODE, ["stub", "live"], "stub"),
    captchaMode: oneOf<CaptchaMode>(env.CAPTCHA_MODE, ["bypass", "live"], "bypass"),
    analyticsMode: oneOf<AnalyticsMode>(env.ANALYTICS_MODE, ["noop", "live"], "noop"),
    archiveMode: oneOf<ArchiveMode>(env.ARCHIVE_MODE, ["file", "live"], "file")
  };
}
