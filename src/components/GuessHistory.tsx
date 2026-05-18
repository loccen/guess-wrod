import type { GuessHistoryItem } from "../app/frontendFlow";

type GuessHistoryProps = {
  guesses: GuessHistoryItem[];
  compact?: boolean;
  showFeedback?: boolean;
};

export function GuessHistory({ guesses, compact = false, showFeedback = false }: GuessHistoryProps) {
  return (
    <div className="guess-list">
      {guesses.map((guess) => (
        <div
          className={`guess-row ${compact ? "guess-row--compact" : ""} ${!compact && !showFeedback ? "guess-row--no-feedback" : ""}`}
          data-ui-id={`guess-row-${guess.rank}`}
          key={guess.guessId}
        >
          <span className="guess-rank">{guess.rank}</span>
          <span className="guess-word">{guess.word}</span>
          <span className="guess-score">{guess.score}%</span>
          {!compact && <span className={`relation relation--${guess.relation}`}>{guess.relation}</span>}
          {!compact && showFeedback && guess.feedbackHref && <a className="feedback-link" href={guess.feedbackHref}>反馈</a>}
          {!compact && showFeedback && !guess.feedbackHref && <span className="feedback-link feedback-link--disabled">反馈</span>}
          {compact && <span className="mini-bar" style={{ "--bar": `${guess.score}%` } as React.CSSProperties} />}
          {compact && showFeedback && guess.feedbackHref && <a className="feedback-link feedback-link--compact" href={guess.feedbackHref}>反馈</a>}
          {compact && showFeedback && !guess.feedbackHref && <span className="feedback-link feedback-link--disabled feedback-link--compact">反馈</span>}
          {compact && !showFeedback && <span className="bubble">···</span>}
        </div>
      ))}
    </div>
  );
}
