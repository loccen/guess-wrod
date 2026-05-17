import type { GuessHistoryItem } from "../app/frontendFlow";

export const demoResultBase = {
  answer: "手机",
  aliasesText: "也接受：智能手机 / 移动电话 / 📱",
  guesses: [
    { rank: 1, word: "电话", score: 92, relation: "近义", feedbackHref: "#" },
    { rank: 2, word: "平板", score: 76, relation: "同类", feedbackHref: "#" },
    { rank: 3, word: "充电器", score: 74, relation: "配件", feedbackHref: "#" }
  ] satisfies GuessHistoryItem[]
};
