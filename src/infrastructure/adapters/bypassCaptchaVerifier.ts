import type { CaptchaVerifier, CaptchaVerificationResult } from "../../usecases/services/platformPorts";

export class BypassCaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async verify(): Promise<CaptchaVerificationResult> {
    return {
      ok: true,
      passedAt: this.now()
    };
  }
}

export class FailingCaptchaVerifier implements CaptchaVerifier {
  async verify(input: { token?: string | null }): Promise<CaptchaVerificationResult> {
    if (!input.token) {
      return {
        ok: false,
        code: "turnstile_required",
        message: "需要补充 Turnstile 校验。"
      };
    }

    return {
      ok: false,
      code: "turnstile_failed",
      message: "当前环境未接入真实 Turnstile 校验。"
    };
  }
}
