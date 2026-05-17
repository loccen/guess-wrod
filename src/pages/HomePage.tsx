import { IconBadge } from "../components/IconBadge";
import { recentGames } from "../mock/game";

export function HomePage() {
  return (
    <main className="phone-page home-page">
      <section className="hero-panel" aria-labelledby="home-title">
        <div className="spark spark-left" />
        <h1 id="home-title" data-ui-id="home-hero-title">猜不到的词</h1>
        <p className="hero-subtitle">AI 只返回百分比，你来推理答案</p>
        <a className="primary-button primary-button--hero" data-ui-id="start-game-button" href="/session">
          <span>开始一局</span>
        </a>
        <a className="secondary-pill" data-ui-id="random-pill" href="/session">
          随机局
        </a>
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
          {recentGames.map((game) => (
            <a className="recent-row" href="/games/demo/result/success" key={game.title}>
              <span>{game.title}</span>
              <em className={`status-pill status-pill--${game.tone}`}>{game.status}</em>
              <b aria-hidden="true">›</b>
            </a>
          ))}
        </div>
      </section>

      <a className="privacy-link" data-ui-id="privacy-link" href="/rules">
        隐私说明
      </a>
    </main>
  );
}
