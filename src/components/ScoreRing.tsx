type ScoreRingProps = {
  score: number;
};

export function ScoreRing({ score }: ScoreRingProps) {
  return (
    <div className="score-ring" data-ui-id="score-ring" style={{ "--score": `${score}%` } as React.CSSProperties}>
      <strong>{score}%</strong>
    </div>
  );
}
