type ScoreRingProps = {
  score: number;
};

export function ScoreRing({ score }: ScoreRingProps) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="score-ring" data-ui-id="score-ring">
      <svg aria-hidden="true" viewBox="0 0 117 123">
        <circle className="score-ring__track" cx="58.5" cy="61.5" r={radius} />
        <circle
          className="score-ring__progress"
          cx="58.5"
          cy="61.5"
          r={radius}
          pathLength={circumference}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <strong>{score}%</strong>
      <span className="score-ring__core" aria-hidden="true" />
      <span className="score-ring__glow" aria-hidden="true" />
    </div>
  );
}
