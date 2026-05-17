import { useEffect, useState } from "react";
import { apiClient } from "../app/apiClient";
import { demoResultBase } from "../mock/game";
import { ensureSession, getErrorMessage, toResultPageModel, type ResultPageModel } from "../app/frontendFlow";
import { GuessHistory } from "../components/GuessHistory";
import { IconBadge } from "../components/IconBadge";
import { buildGamePath, buildResultPath, toResultMode, type ResultMode, type RouteState } from "../routes/routeState";

type ResultPageProps = {
  route: Extract<RouteState, { page: "result" }>;
  navigate: (to: string, options?: { replace?: boolean }) => void;
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

type ResultScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; model: ResultPageModel };

export function ResultPage({ route, navigate }: ResultPageProps) {
  const mode = route.mode;
  const copy = modeCopy[mode];
  const [screenState, setScreenState] = useState<ResultScreenState>(route.demo ? {
    status: "ready",
    model: {
      answer: demoResultBase.answer,
      aliasesText: demoResultBase.aliasesText,
      statAValue: mode === "expired" ? "100次" : mode === "success" ? "10次" : "8次",
      statBValue: mode === "success" ? "6分18秒" : mode === "expired" ? "92%" : "76%",
      statCValue: mode === "success" ? "100%" : mode === "expired" ? "过期" : "放弃",
      guesses: demoResultBase.guesses
    }
  } : { status: "loading" });

  useEffect(() => {
    if (route.demo || !route.gameId) {
      return;
    }

    const gameId = route.gameId;
    let active = true;

    void (async () => {
      setScreenState({ status: "loading" });
      try {
        const token = await ensureSession().then((restored) => restored.token);
        const game = await apiClient.getGame(token, gameId);
        const actualMode = toResultMode(game.status);

        if (!actualMode) {
          navigate(buildGamePath(game.game_id), { replace: true });
          return;
        }

        if (actualMode !== route.mode) {
          navigate(buildResultPath(game.game_id, actualMode), { replace: true });
          return;
        }

        if (!active) {
          return;
        }

        setScreenState({
          status: "ready",
          model: toResultPageModel(route.mode, game)
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setScreenState({ status: "error", message: getErrorMessage(error) });
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate, route.demo, route.gameId, route.mode]);

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
            <strong>{screenState.status === "ready" ? screenState.model.answer : "读取中"}</strong>
            <p>{screenState.status === "ready" ? screenState.model.aliasesText : "正在加载答案"}</p>
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
        <StatCard label={copy.statA[0]} value={screenState.status === "ready" ? screenState.model.statAValue : copy.statA[1]} icon="◎" />
        <StatCard label={copy.statB[0]} value={screenState.status === "ready" ? screenState.model.statBValue : copy.statB[1]} icon={mode === "success" ? "◷" : "♕"} />
        <StatCard label={copy.statC[0]} value={screenState.status === "ready" ? screenState.model.statCValue : copy.statC[1]} icon={mode === "success" ? "♕" : "⚐"} />
      </section>

      <section className="card review-card" data-ui-id={copy.extraId}>
        <div className="section-title">
          <IconBadge label="▥" />
          <h2>{copy.listTitle}</h2>
        </div>
        {screenState.status === "error" ? (
          <div className="inline-panel">
            <p className="inline-error">{screenState.message}</p>
          </div>
        ) : (
          <GuessHistory guesses={screenState.status === "ready" ? screenState.model.guesses : demoResultBase.guesses} compact />
        )}
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
