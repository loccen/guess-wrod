import { useEffect, useRef, useState } from "react";
import { apiClient } from "../app/apiClient";
import {
  ensureSession,
  formatExpiresText,
  getErrorMessage,
  isFrontendApiError,
  toGamePageModel,
  toGuessSubmitNotice
} from "../app/frontendFlow";
import { GuessHistory } from "../components/GuessHistory";
import { IconBadge } from "../components/IconBadge";
import { ScoreRing } from "../components/ScoreRing";
import { buildResultPath, toResultMode, type RouteState } from "../routes/routeState";

type GamePageProps = {
  route: Extract<RouteState, { page: "game" }>;
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

type GameScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      model: ReturnType<typeof toGamePageModel>;
    };

function buildDemoFallbackModel() {
  return {
    gameId: "demo-playing",
    countText: "第 0 次 / 100",
    expiresText: "剩余 24 小时",
    bestGuessWord: "还没有",
    bestGuessScore: 0,
    guesses: []
  };
}

export function GamePage({ route, navigate }: GamePageProps) {
  const [screenState, setScreenState] = useState<GameScreenState>({ status: "loading" });
  const [guessText, setGuessText] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [giveUpPending, setGiveUpPending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [historyScrollState, setHistoryScrollState] = useState({
    canScroll: false,
    showTopButton: false,
    showBottomButton: false
  });
  const historyScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadGame() {
      setScreenState({ status: "loading" });
      setInlineError(null);

      try {
        const restored = await ensureSession();
        let gameId = route.gameId;
        if (route.demo && !gameId) {
          if (restored.session.active_game_id) {
            gameId = restored.session.active_game_id;
          } else {
            const created = await apiClient.createGame(restored.token);
            if (!active) {
              return;
            }
            setScreenState({
              status: "ready",
              model: {
                gameId: created.game_id,
                countText: `第 ${created.guess_count} 次 / 100`,
                expiresText: formatExpiresText(created.started_at),
                bestGuessWord: "还没有",
                bestGuessScore: 0,
                guesses: []
              }
            });
            return;
          }
        }

        if (!gameId) {
          navigate("/", { replace: true });
          return;
        }

        const game = await apiClient.getGame(restored.token, gameId);
        const resultMode = toResultMode(game.status);
        if (resultMode) {
          navigate(buildResultPath(game.game_id, resultMode), { replace: true });
          return;
        }

        if (!active) {
          return;
        }

        setScreenState({
          status: "ready",
          model: toGamePageModel(game)
        });
      } catch (error) {
        if (!active) {
          return;
        }
        if (route.demo) {
          setScreenState({
            status: "ready",
            model: buildDemoFallbackModel()
          });
          return;
        }
        setScreenState({ status: "error", message: getErrorMessage(error) });
      }
    }

    void loadGame();

    return () => {
      active = false;
    };
  }, [navigate, route.demo, route.gameId]);

  async function refreshReadyGame(gameId: string, token?: string) {
    const sessionToken = token ? token : (await ensureSession()).token;
    const game = await apiClient.getGame(sessionToken, gameId);
    const resultMode = toResultMode(game.status);
    if (resultMode) {
      navigate(buildResultPath(game.game_id, resultMode), { replace: true });
      return;
    }

    setScreenState({
      status: "ready",
      model: toGamePageModel(game)
    });
  }

  async function handleSubmitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screenState.status !== "ready" || submitPending) {
      return;
    }

    const nextGuess = guessText.trim();
    if (!nextGuess) {
      setInlineError("请输入一个猜词。");
      setSubmitNotice(null);
      return;
    }

    setSubmitPending(true);
    setInlineError(null);
    setSubmitNotice(null);

    try {
      const token = await ensureSession().then((restored) => restored.token);
      const result = await apiClient.submitGuess(token, screenState.model.gameId, nextGuess);
      setSubmitNotice(toGuessSubmitNotice(result));

      if (result.status === "success") {
        setGuessText("");
        navigate(buildResultPath(screenState.model.gameId, "success"));
        return;
      }

      await refreshReadyGame(screenState.model.gameId, token);
      if (result.counted) {
        setGuessText("");
      }
    } catch (error) {
      if (isFrontendApiError(error) && error.code === "game_ended") {
        try {
          await refreshReadyGame(screenState.status === "ready" ? screenState.model.gameId : route.gameId ?? "");
          return;
        } catch {
          // 保留原始错误提示，由外层继续处理。
        }
      }

      setInlineError(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleGiveUp() {
    if (screenState.status !== "ready") {
      return;
    }

    setGiveUpPending(true);
    setInlineError(null);
    try {
      const token = await ensureSession().then((restored) => restored.token);
      await apiClient.giveUpGame(token, screenState.model.gameId);
      navigate(buildResultPath(screenState.model.gameId, "give-up"));
    } catch (error) {
      setInlineError(getErrorMessage(error));
    } finally {
      setGiveUpPending(false);
    }
  }

  const bestGuess = screenState.status === "ready" ? screenState.model : null;
  const canSubmit = screenState.status === "ready" && guessText.trim().length > 0 && !submitPending && !giveUpPending;
  const historyGuesses = screenState.status === "ready" ? screenState.model.guesses : [];

  useEffect(() => {
    function syncHistoryScrollState() {
      const container = historyScrollRef.current;
      if (!container) {
        setHistoryScrollState({
          canScroll: false,
          showTopButton: false,
          showBottomButton: false
        });
        return;
      }

      const overflowGap = container.scrollHeight - container.clientHeight;
      const canScroll = overflowGap > 8;
      const showTopButton = canScroll && container.scrollTop > 12;
      const showBottomButton = canScroll && container.scrollTop < overflowGap - 12;

      setHistoryScrollState((current) => {
        if (
          current.canScroll === canScroll &&
          current.showTopButton === showTopButton &&
          current.showBottomButton === showBottomButton
        ) {
          return current;
        }

        return {
          canScroll,
          showTopButton,
          showBottomButton
        };
      });
    }

    syncHistoryScrollState();
    window.addEventListener("resize", syncHistoryScrollState);
    return () => {
      window.removeEventListener("resize", syncHistoryScrollState);
    };
  }, [historyGuesses]);

  function handleHistoryScroll() {
    const container = historyScrollRef.current;
    if (!container) {
      return;
    }

    const overflowGap = container.scrollHeight - container.clientHeight;
    const canScroll = overflowGap > 8;
    setHistoryScrollState({
      canScroll,
      showTopButton: canScroll && container.scrollTop > 12,
      showBottomButton: canScroll && container.scrollTop < overflowGap - 12
    });
  }

  function scrollHistoryTo(position: "top" | "bottom") {
    const container = historyScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: position === "top" ? 0 : container.scrollHeight,
      behavior: "smooth"
    });
  }

  return (
    <main className="phone-page game-page">
      <header className="game-header">
        <h1 data-ui-id="game-title">猜不到的词</h1>
        <p>猜一个词，看它离答案有多近</p>
        <div className="status-row">
          <span><IconBadge label="◎" size="sm" />{bestGuess?.countText ?? "读取中"}</span>
          <span><IconBadge label="◷" tone="warning" size="sm" />{bestGuess?.expiresText ?? "同步状态中"}</span>
        </div>
      </header>

      <section className="card best-card" data-ui-id="best-card">
        <div data-ui-id="best-guess-text">
          <div className="section-title section-title--tight">
            <IconBadge label="▥" />
            <h2>当前最高</h2>
          </div>
          <strong className={`best-word ${bestGuess?.bestGuessWord === "还没有" ? "best-word--empty" : ""}`}>
            {bestGuess?.bestGuessWord ?? "读取中"}
          </strong>
          <p>越接近 100%，越靠近答案</p>
        </div>
        <ScoreRing score={bestGuess?.bestGuessScore ?? 0} />
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${bestGuess?.bestGuessScore ?? 0}%` }} /></div>
      </section>

      <section className="card input-card" data-ui-id="guess-form">
        <form className="guess-form" onSubmit={handleSubmitGuess}>
          <label className="guess-input-shell" data-ui-id="guess-input">
            {!guessText && <span className="placeholder-text">输入一个猜词</span>}
            <input
              value={guessText}
              onChange={(event) => setGuessText(event.target.value)}
              placeholder=""
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={screenState.status !== "ready" || submitPending || giveUpPending}
            />
          </label>
          <button data-ui-id="submit-button" type="submit" disabled={!canSubmit}>
            {submitPending ? "提交中" : "提交"}
          </button>
        </form>
        <p className="scoring-state" data-ui-id="guess-status">
          {(screenState.status === "loading" || submitPending) && <span className="spinner" />}
          {screenState.status === "loading"
            ? "正在加载本局状态"
            : submitPending
              ? "AI 评分中，通常约 2 秒"
              : "输入一个词，提交后会显示真实分数与历史"}
        </p>
        {submitNotice && (
          <p className={`inline-note inline-note--${submitNotice.tone}`} data-ui-id="guess-submit-note">
            {submitNotice.text}
          </p>
        )}
        {inlineError && <p className="inline-error" data-ui-id="guess-submit-error">{inlineError}</p>}
      </section>

      <section className="card history-card" data-ui-id="history-card">
        <div className="section-title">
          <IconBadge label="◷" tone="muted" />
          <h2>猜词历史</h2>
        </div>
        {screenState.status === "error" ? (
          <div className="inline-panel">
            <p className="inline-error">{screenState.message}</p>
            <button className="secondary-action" type="button" onClick={() => window.location.reload()}>
              重试
            </button>
          </div>
        ) : screenState.status === "ready" && screenState.model.guesses.length > 0 ? (
          <div className="history-list-shell">
            <div className="history-scroll-fade history-scroll-fade--top" aria-hidden={!historyScrollState.showTopButton} />
            <div
              ref={historyScrollRef}
              className="history-scroll-area"
              onScroll={handleHistoryScroll}
            >
              <GuessHistory guesses={screenState.model.guesses} />
            </div>
            <div className="history-scroll-fade history-scroll-fade--bottom" aria-hidden={!historyScrollState.showBottomButton} />
            {historyScrollState.canScroll && (
              <div className="history-scroll-actions">
                {historyScrollState.showTopButton && (
                  <button
                    className="history-scroll-button"
                    type="button"
                    onClick={() => scrollHistoryTo("top")}
                    aria-label="滚动到历史顶部"
                  >
                    到顶
                  </button>
                )}
                {historyScrollState.showBottomButton && (
                  <button
                    className="history-scroll-button"
                    type="button"
                    onClick={() => scrollHistoryTo("bottom")}
                    aria-label="滚动到历史底部"
                  >
                    到底
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="empty-hint">还没有有效猜词。提交后，这里会显示真实历史。</p>
        )}
      </section>

      <button className="danger-button" data-ui-id="give-up-button" type="button" onClick={handleGiveUp} disabled={giveUpPending || screenState.status !== "ready"}>
        放弃看答案
      </button>

    </main>
  );
}
