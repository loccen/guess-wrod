import type {
  AiMode,
  AnalyticsMode,
  AppConfig,
  ArchiveMode,
  CaptchaMode
} from "../../domain/models/appConfig";
import type { RuntimeVersionInfo } from "../../domain/models/health";

export interface RuntimeEnv {
  AI_MODE?: string;
  CAPTCHA_MODE?: string;
  ANALYTICS_MODE?: string;
  ARCHIVE_MODE?: string;
  CF_PAGES_COMMIT_SHA?: string;
  GIT_COMMIT_SHA?: string;
  BUILD_ID?: string;
  RUNTIME_VERSION?: string;
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

function normalizeVersion(raw: string, source: RuntimeVersionInfo["source"]): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "unknown";
  }

  if ((source === "cf_pages_commit_sha" || source === "git_commit_sha") && /^[0-9a-fA-F]{7,64}$/.test(trimmed)) {
    return trimmed.toLowerCase().slice(0, 12);
  }

  const safe = trimmed.replace(/[^0-9a-zA-Z._-]/g, "_");
  if (safe.length === 0) {
    return "unknown";
  }

  return safe.slice(0, 64);
}

export function loadRuntimeVersion(env: RuntimeEnv = {}): RuntimeVersionInfo {
  const candidates: Array<{ value: string | undefined; source: RuntimeVersionInfo["source"] }> = [
    { value: env.CF_PAGES_COMMIT_SHA, source: "cf_pages_commit_sha" },
    { value: env.GIT_COMMIT_SHA, source: "git_commit_sha" },
    { value: env.BUILD_ID, source: "build_id" },
    { value: env.RUNTIME_VERSION, source: "runtime_version" }
  ];

  for (const candidate of candidates) {
    if (candidate.value && candidate.value.trim().length > 0) {
      return {
        version: normalizeVersion(candidate.value, candidate.source),
        source: candidate.source
      };
    }
  }

  return {
    version: "unknown",
    source: "unknown"
  };
}
