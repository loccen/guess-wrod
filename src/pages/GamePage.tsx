import { GuessHistory } from "../components/GuessHistory";
import { IconBadge } from "../components/IconBadge";
import { ScoreRing } from "../components/ScoreRing";
import { mockGame } from "../mock/game";

type GamePageProps = {
  showFeedback: boolean;
};

export function GamePage({ showFeedback }: GamePageProps) {
  return (
    <main className={`phone-page game-page ${showFeedback ? "is-dimmed" : ""}`}>
      <header className="game-header">
        <h1>猜不到的词</h1>
        <p>猜一个词，看它离答案有多近</p>
        <div className="status-row">
          <span><IconBadge label="◎" size="sm" />{mockGame.countText}</span>
          <span><IconBadge label="◷" tone="warning" size="sm" />{mockGame.expiresText}</span>
        </div>
      </header>

      <section className="card best-card" data-ui-id="best-card">
        <div data-ui-id="best-guess-text">
          <div className="section-title section-title--tight">
            <IconBadge label="▥" />
            <h2>当前最高</h2>
          </div>
          <strong className="best-word">{mockGame.bestGuess.word}</strong>
          <p>越接近 100%，越靠近答案</p>
        </div>
        <ScoreRing score={mockGame.bestGuess.score} />
        <div className="progress-track" aria-hidden="true"><span /></div>
      </section>

      <section className="card input-card">
        <div className="guess-form" data-ui-id="guess-form">
          <label data-ui-id="guess-input">
            <span className="search-mark" aria-hidden="true">⌕</span>
            <span className="placeholder-text">输入一个猜词</span>
          </label>
          <button data-ui-id="submit-button" type="button">提交</button>
        </div>
        <p className="scoring-state"><span className="spinner" />AI 评分中 · 约 2 秒</p>
      </section>

      <section className="card history-card" data-ui-id="history-card">
        <div className="section-title">
          <IconBadge label="◷" tone="muted" />
          <h2>猜词历史</h2>
        </div>
        <GuessHistory guesses={mockGame.guesses} />
      </section>

      <a className="danger-button" data-ui-id="give-up-button" href="/games/demo/result/give-up">
        放弃看答案
      </a>

      {showFeedback && <FeedbackSheet />}
    </main>
  );
}

function FeedbackSheet() {
  return (
    <div className="feedback-layer">
      <div className="feedback-backdrop" data-ui-id="feedback-backdrop" />
      <section className="feedback-sheet" data-ui-id="feedback-sheet" aria-labelledby="feedback-title">
        <span className="sheet-handle" />
        <a className="sheet-close" href="/games/demo-playing" aria-label="关闭反馈">×</a>
        <div className="sheet-title-row">
          <IconBadge label="☵" />
          <div>
            <h2 id="feedback-title" data-ui-id="feedback-title">这个分数不合理吗？</h2>
            <p>我们会用反馈改进评分</p>
          </div>
        </div>
        <div className="feedback-summary">
          <span>你猜的词<strong>平板</strong></span>
          <span>当前分数<strong>76%</strong></span>
          <span>词与答案的关系<strong>同类</strong></span>
        </div>
        <div className="feedback-options" data-ui-id="feedback-options">
          <button className="is-selected" type="button"><span>↑</span>分数偏高</button>
          <button type="button"><span>↓</span>分数偏低</button>
          <button type="button"><span>×</span>关系不对</button>
        </div>
        <label className="feedback-text">
          <span>✎</span>
          <textarea maxLength={100} placeholder="补充说明（可选，最多100字）" />
          <em>0/100</em>
        </label>
        <p className="sheet-note">♙ 只记录本次猜词反馈</p>
        <div className="sheet-actions">
          <a href="/games/demo-playing">取消</a>
          <button data-ui-id="feedback-submit" type="button">提交反馈</button>
        </div>
      </section>
    </div>
  );
}
