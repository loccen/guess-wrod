import { useEffect, useMemo, useState } from "react";
import { FEEDBACK_NOTE_LIMIT, buildFeedbackNote, feedbackOptions, type FeedbackOptionId, validateFeedbackNote } from "../app/feedbackFlow";
import type { GuessHistoryItem } from "../app/frontendFlow";
import { IconBadge } from "./IconBadge";

type FeedbackSheetProps = {
  guess: GuessHistoryItem;
  gamePath: string;
  submitFeedback: (input: { guessId: string; note: string | null }) => Promise<void>;
};

export function FeedbackSheet({ guess, gamePath, submitFeedback }: FeedbackSheetProps) {
  const [selectedOption, setSelectedOption] = useState<FeedbackOptionId>("score-high");
  const [note, setNote] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedOption("score-high");
    setNote("");
    setSubmitPending(false);
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [guess.guessId]);

  const selectedOptionMeta = useMemo(
    () => feedbackOptions.find((item) => item.id === selectedOption) ?? feedbackOptions[0],
    [selectedOption]
  );
  const noteError = validateFeedbackNote(selectedOption, note);
  const canSubmit = !submitPending && !submitSuccess && !noteError;

  async function handleSubmit() {
    if (!canSubmit) {
      if (noteError) {
        setSubmitError(noteError);
      }
      return;
    }

    setSubmitPending(true);
    setSubmitError(null);

    try {
      await submitFeedback({
        guessId: guess.guessId,
        note: buildFeedbackNote(selectedOption, note)
      });
      setSubmitSuccess("已收到这条反馈，我们会用它改进后续评分。");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitPending(false);
    }
  }

  return (
    <div className="feedback-layer">
      <a className="feedback-backdrop" data-ui-id="feedback-backdrop" href={gamePath} aria-label="关闭反馈" />
      <section
        className="feedback-sheet"
        data-ui-id="feedback-sheet"
        aria-labelledby="feedback-title"
        aria-modal="true"
        role="dialog"
      >
        <span className="sheet-handle" />
        <a className="sheet-close" href={gamePath} aria-label="关闭反馈">×</a>
        <div className="sheet-title-row">
          <IconBadge label="☵" />
          <div>
            <h2 id="feedback-title" data-ui-id="feedback-title">这个分数不合理吗？</h2>
            <p>我们会用反馈改进评分</p>
          </div>
        </div>
        <div className="feedback-summary">
          <span>你猜的词<strong>{guess.word}</strong></span>
          <span>当前分数<strong>{guess.score}%</strong></span>
          <span>词与答案的关系<strong>{guess.relation}</strong></span>
        </div>
        <div className="feedback-options" data-ui-id="feedback-options">
          {feedbackOptions.map((option) => (
            <button
              className={selectedOption === option.id ? "is-selected" : ""}
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedOption(option.id);
                setSubmitError(null);
                setSubmitSuccess(null);
              }}
              disabled={submitPending || Boolean(submitSuccess)}
            >
              <span>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
        <label className="feedback-text">
          <span>✎</span>
          <textarea
            data-ui-id="feedback-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (submitError) {
                setSubmitError(null);
              }
              if (submitSuccess) {
                setSubmitSuccess(null);
              }
            }}
            maxLength={FEEDBACK_NOTE_LIMIT}
            placeholder="补充说明（可选，最多100字）"
            disabled={submitPending || Boolean(submitSuccess)}
          />
          <em>{note.length}/{FEEDBACK_NOTE_LIMIT}</em>
        </label>
        {selectedOptionMeta.notePrefix && (
          <p className="sheet-note">
            该方向会按“评分不合理”提交，并附带“{selectedOptionMeta.label}”说明。
          </p>
        )}
        {submitError && <p className="inline-error" data-ui-id="feedback-submit-error">{submitError}</p>}
        {submitSuccess && <p className="inline-note inline-note--success" data-ui-id="feedback-submit-success">{submitSuccess}</p>}
        <div className="sheet-actions">
          <a href={gamePath}>{submitSuccess ? "返回游戏" : "取消"}</a>
          <button data-ui-id="feedback-submit" type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitPending ? "提交中" : submitSuccess ? "已提交" : "提交反馈"}
          </button>
        </div>
      </section>
    </div>
  );
}
