import type { GuessHistoryItem } from "../app/frontendFlow";

type GuessHistoryProps = {
  guesses: GuessHistoryItem[];
  compact?: boolean;
};

export function GuessHistory({ guesses, compact = false }: GuessHistoryProps) {
  return (
    <div className="guess-list">
      {guesses.map((guess) => (
        <div className={`guess-row ${compact ? "guess-row--compact" : ""}`} data-ui-id={`guess-row-${guess.rank}`} key={guess.rank}>
          <span className="guess-rank">{guess.rank}</span>
          <span className="guess-word">{guess.word}</span>
          <span className="guess-score">{guess.score}%</span>
          {!compact && <span className={`relation relation--${guess.relation}`}>{guess.relation}</span>}
          {!compact && <a className="feedback-link" href={guess.feedbackHref}>反馈</a>}
          {compact && <span className="mini-bar" style={{ "--bar": `${guess.score}%` } as React.CSSProperties} />}
          {compact && <span className="bubble">···</span>}
        </div>
      ))}
    </div>
  );
}
