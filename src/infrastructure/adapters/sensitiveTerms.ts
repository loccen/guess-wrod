import type { SensitiveTermChecker } from "../../usecases/services/platformPorts";

const RAW_SENSITIVE_TERMS = [
  "色情",
  "成人",
  "赌博",
  "博彩",
  "毒品",
  "枪支",
  "爆炸",
  "自杀",
  "诈骗",
  "黑产",
  "仇恨",
  "歧视",
  "辱骂",
  "血腥",
  "恐怖",
  "极端",
  "违法",
  "攻击",
  "隐私",
  "身份证",
  "银行卡",
  "密码",
  "token",
  "cookie",
  "密钥"
] as const;

function normalizeTerm(term: string): string {
  return term.trim().normalize("NFKC").toLocaleLowerCase("und");
}

export class LocalSensitiveTermChecker implements SensitiveTermChecker {
  readonly terms: readonly string[];

  constructor(terms: readonly string[] = RAW_SENSITIVE_TERMS) {
    this.terms = terms.map(normalizeTerm).filter(Boolean);
  }

  matches(normalizedText: string): boolean {
    return this.terms.some((term) => normalizedText.includes(term));
  }
}
