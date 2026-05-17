import { GuessHistory } from "../components/GuessHistory";
import { IconBadge } from "../components/IconBadge";
import { resultBase } from "../mock/game";
import type { ResultMode } from "../routes/routeState";

type ResultPageProps = {
  mode: ResultMode;
};

const modeCopy = {
  success: {
    icon: "✓",
    heading: "猜到了！",
    subheading: "你找到了答案",
    statA: ["有效猜词", "10次"],
    statB: ["用时", "6分18秒"],
    statC: ["最高分", "100%"],
    listTitle: "最接近未命中",
    extraId: "near-miss-card",
    extraText: "",
    tone: "success",
  },
  "give-up": {
    icon: "⚐",
    heading: "本局已放弃",
    subheading: "答案已经揭晓",
    statA: ["有效猜词", "8次"],
    statB: ["最高分", "76%"],
    statC: ["状态", "放弃"],
    listTitle: "差一点的线索",
    extraId: "clue-card",
    extraText: "下次可以从功能、配件、使用场景继续猜",
    tone: "danger",
  },
  expired: {
    icon: "◷",
    heading: "本局已过期",
    subheading: "答案已揭晓",
    statA: ["有效猜词", "100次"],
    statB: ["最高分", "92%"],
    statC: ["状态", "过期"],
    listTitle: "最高分路径",
    extraId: "best-path-card",
    extraText: "",
    tone: "warning",
  },
} as const;

export function ResultPage({ mode }: ResultPageProps) {
  const copy = modeCopy[mode];

  return (
    <main className={`phone-page result-page result-page--${copy.tone}`}>
      <header className="result-header">
        <IconBadge label={copy.icon} size="lg" tone={copy.tone === "danger" ? "danger" : "primary"} />
        <h1 data-ui-id="result-heading">{copy.heading}</h1>
        <p>{copy.subheading}</p>
      </header>

      <section className="card answer-card" data-ui-id="answer-card">
        <div className="section-title section-title--tight">
          <IconBadge label="♙" />
          <h2>答案</h2>
        </div>
        <div className="answer-body">
          <div className="phone-glyph" aria-hidden="true" />
          <div>
            <strong>{resultBase.answer}</strong>
            <p>{resultBase.aliases}</p>
          </div>
        </div>
      </section>

      {mode === "expired" && (
        <section className="card reason-card" data-ui-id="expired-reason-card">
          <h2>过期原因</h2>
          <strong>达到 100 次有效猜词</strong>
          <p>或超过 24 小时未完成</p>
        </section>
      )}

      <section className="stats-row" data-ui-id="stats-row">
        <StatCard label={copy.statA[0]} value={copy.statA[1]} icon="◎" />
        <StatCard label={copy.statB[0]} value={copy.statB[1]} icon={mode === "success" ? "◷" : "♕"} />
        <StatCard label={copy.statC[0]} value={copy.statC[1]} icon={mode === "success" ? "♕" : "⚐"} />
      </section>

      <section className="card review-card" data-ui-id={copy.extraId}>
        <div className="section-title">
          <IconBadge label="▥" />
          <h2>{copy.listTitle}</h2>
        </div>
        <GuessHistory guesses={resultBase.nearMisses} compact />
        {copy.extraText && <p className="hint-strip">{copy.extraText}</p>}
      </section>

      <a className="primary-button" data-ui-id="play-again-button" href="/session">
        <span aria-hidden="true">↻</span>
        再来一局
      </a>
      <a className="home-link" href="/">⌂ 返回首页 ›</a>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="stat-card">
      <IconBadge label={icon} tone="warning" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
