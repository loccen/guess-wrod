import { useEffect, useState } from "react";
import { apiClient } from "../app/apiClient";
import { ensureSession, getErrorMessage } from "../app/frontendFlow";
import { IconBadge } from "../components/IconBadge";
import { buildGamePath } from "../routes/routeState";

type HomePageProps = {
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

export function HomePage({ navigate }: HomePageProps) {
  const [createPending, setCreatePending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [healthText, setHealthText] = useState("API 检查中");

  useEffect(() => {
    void ensureSession().catch(() => {});
    void apiClient
      .getHealth()
      .then((health) => {
        setHealthText(`${health.service} · ${health.status.toUpperCase()}`);
      })
      .catch(() => {
        setHealthText("API 未连通");
      });
  }, []);

  async function handleStartGame() {
    setCreatePending(true);
    setErrorText(null);

    try {
      const restored = await ensureSession();
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
        <a className="secondary-pill" data-ui-id="random-pill" href="/session">
          随机局
        </a>
        <p className="hero-status">{createPending ? "正在创建游戏" : healthText}</p>
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
          <div className="recent-row recent-row--placeholder">
            <span>历史成绩列表接入中</span>
            <em className="status-pill status-pill--muted">暂未开放</em>
            <b aria-hidden="true">›</b>
          </div>
          <div className="recent-helper">当前已切到真实会话和开局接口，成绩列表仍保留占位。</div>
        </div>
      </section>

      <a className="privacy-link" data-ui-id="privacy-link" href="/rules">
        隐私说明
      </a>
    </main>
  );
}
