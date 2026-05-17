export type FeedbackOptionId = "score-high" | "score-low" | "relation-wrong";

export type FeedbackOption = {
  id: FeedbackOptionId;
  icon: string;
  label: string;
  notePrefix: string | null;
};

export const feedbackOptions: FeedbackOption[] = [
  {
    id: "score-high",
    icon: "↑",
    label: "分数偏高",
    notePrefix: null
  },
  {
    id: "score-low",
    icon: "↓",
    label: "分数偏低",
    notePrefix: "反馈方向：分数偏低"
  },
  {
    id: "relation-wrong",
    icon: "×",
    label: "关系不对",
    notePrefix: "反馈方向：关系不对"
  }
];

export const FEEDBACK_NOTE_LIMIT = 100;
export const FEEDBACK_API_NOTE_LIMIT = 200;

export function buildFeedbackNote(optionId: FeedbackOptionId, note: string): string | null {
  const option = feedbackOptions.find((item) => item.id === optionId) ?? feedbackOptions[0];
  const trimmedNote = note.trim();

  if (!option.notePrefix) {
    return trimmedNote.length > 0 ? trimmedNote : null;
  }

  if (trimmedNote.length === 0) {
    return option.notePrefix;
  }

  return `${option.notePrefix}；${trimmedNote}`;
}

export function validateFeedbackNote(optionId: FeedbackOptionId, note: string): string | null {
  if (note.length > FEEDBACK_NOTE_LIMIT) {
    return `补充说明最多 ${FEEDBACK_NOTE_LIMIT} 个字。`;
  }

  const payloadNote = buildFeedbackNote(optionId, note);
  if (payloadNote && payloadNote.length > FEEDBACK_API_NOTE_LIMIT) {
    return "补充说明过长，请再精简一些。";
  }

  return null;
}
