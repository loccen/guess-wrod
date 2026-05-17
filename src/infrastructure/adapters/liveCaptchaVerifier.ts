import type { CaptchaVerifier, CaptchaVerificationResult } from "../../usecases/services/platformPorts";

interface TurnstileVerifyResponse {
  success?: boolean;
}

export interface LiveCaptchaVerifierConfig {
  secret: string;
  endpoint?: string;
  fetch?: typeof fetch;
}

const DEFAULT_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export class LiveCaptchaVerifier implements CaptchaVerifier {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly config: LiveCaptchaVerifierConfig, private readonly now: () => string = () => new Date().toISOString()) {
    this.fetchImpl = config.fetch ?? fetch;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  }

  async verify(input: { token?: string | null }): Promise<CaptchaVerificationResult> {
    if (!input.token) {
      return { ok: false, code: "turnstile_required", message: "需要补充 Turnstile 校验。" };
    }

    const body = new URLSearchParams({ secret: this.config.secret, response: input.token });
    const response = await this.fetchImpl(this.endpoint, { method: "POST", body });
    if (!response.ok) {
      return { ok: false, code: "turnstile_failed", message: "Turnstile 校验请求失败。" };
    }

    const payload = (await response.json()) as TurnstileVerifyResponse;
    if (!payload.success) {
      return { ok: false, code: "turnstile_failed", message: "Turnstile 校验未通过。" };
    }

    return { ok: true, passedAt: this.now() };
  }
}
