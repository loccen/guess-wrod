import { useEffect, useState } from "react";
import { apiClient } from "../app/apiClient";
import { ensureSession, ensureSessionWithOptions, getErrorMessage, toHistoryListItems, type HistoryListItem } from "../app/frontendFlow";
import { IconBadge } from "../components/IconBadge";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { buildGamePath, buildHistoryPath } from "../routes/routeState";

type HomePageProps = {
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

export function HomePage({ navigate }: HomePageProps) {
  const [createPending, setCreatePending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [captchaMode, setCaptchaMode] = useState<"bypass" | "live">("bypass");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .getHealth()
      .then((health) => {
        const mode = health.modes?.captchaMode === "live" ? "live" : "bypass";
        setCaptchaMode(mode);
        setTurnstileSiteKey(health.captchaRuntime?.turnstileSiteKey ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      setHistoryLoading(true);
      try {
        const token = await ensureSession().then((restored) => restored.token);
        const history = await apiClient.listGameHistory(token, { page: 1, pageSize: 3 });
        if (!active) {
          return;
        }
        setHistoryItems(toHistoryListItems(history.items));
      } catch {
        if (!active) {
          return;
        }
        setHistoryItems([]);
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleStartGame() {
    setCreatePending(true);
    setErrorText(null);

    try {
      if (captchaMode === "live" && !turnstileToken) {
        throw new Error("请先完成安全验证。");
      }

      const restored = await ensureSessionWithOptions({
        turnstileToken: captchaMode === "live" ? turnstileToken : null
      });
      const game = await apiClient.createGame(restored.token);
      navigate(buildGamePath(game.game_id));
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <main className="phone-page home-page">
      <section className="hero-panel" aria-labelledby="home-title">
        <div className="spark spark-left" />
        <h1 id="home-title" data-ui-id="home-hero-title">猜不到的词</h1>
        <p className="hero-subtitle">AI 只返回百分比，你来推理答案</p>
        <button
          className="primary-button primary-button--hero"
          data-ui-id="start-game-button"
          type="button"
          onClick={handleStartGame}
          disabled={createPending}
        >
          <span>开始一局</span>
        </button>
        {captchaMode === "live" && turnstileSiteKey && (
          <div className="captcha-panel">
            <p className="captcha-title">先完成安全验证，再开始本局</p>
            <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} />
          </div>
        )}
        {captchaMode === "live" && !turnstileSiteKey && (
          <p className="inline-error inline-error--hero">当前环境缺少 TURNSTILE_SITE_KEY，无法创建会话。</p>
        )}
        <a className="secondary-pill" data-ui-id="random-pill" href="/session">
          随机局
        </a>
        {createPending && <p className="hero-status">正在创建游戏</p>}
        {errorText && <p className="inline-error inline-error--hero">{errorText}</p>}
      </section>

      <section className="card rules-preview" data-ui-id="rules-card">
        <div className="section-title">
          <IconBadge label="□" />
          <h2>玩法说明</h2>
          <span className="decor-star">✦</span>
        </div>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <strong>输入一个词</strong>
              <p>开始猜测</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>只看接近百分比</strong>
              <p>只看分数</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>100% 即猜中</strong>
              <p>接近答案</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card recent-card" data-ui-id="recent-card">
        <div className="section-title">
          <IconBadge label="◎" />
          <h2>最近成绩</h2>
        </div>
        <div className="recent-list">
          {historyLoading && <p className="recent-helper">正在读取最近成绩</p>}
          {!historyLoading &&
            historyItems.map((item) => (
              <button
                key={item.gameId}
                type="button"
                className="recent-row recent-row--button"
                onClick={() => navigate(item.resultHref)}
              >
                <span>{item.title}</span>
                <em className={`status-pill status-pill--${item.statusTone}`}>{item.statusText}</em>
                <b aria-hidden="true">›</b>
              </button>
            ))}
          {!historyLoading && historyItems.length === 0 && (
            <div className="recent-row recent-row--placeholder">
              <span>还没有已结束对局</span>
              <em className="status-pill status-pill--muted">空</em>
            </div>
          )}
        </div>
        <button type="button" className="secondary-pill secondary-pill--button" onClick={() => navigate(buildHistoryPath())}>
          查看全部历史
        </button>
      </section>

      <a className="privacy-link" data-ui-id="privacy-link" href="/rules">
        隐私说明
      </a>
    </main>
  );
}
