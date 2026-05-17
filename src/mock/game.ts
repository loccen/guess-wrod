export type Guess = {
  rank: number;
  word: string;
  score: number;
  relation: string;
};

export type RecentGame = {
  title: string;
  status: string;
  tone: "success" | "warning" | "muted";
};

export const mockGame = {
  status: "playing",
  countText: "第 7 次 / 100",
  expiresText: "剩余 23 小时",
  bestGuess: {
    word: "平板",
    score: 76,
    relation: "同类",
  },
  guesses: [
    { rank: 1, word: "平板", score: 76, relation: "同类" },
    { rank: 2, word: "充电器", score: 74, relation: "配件" },
    { rank: 3, word: "维修", score: 72, relation: "场景" },
    { rank: 4, word: "电器", score: 66, relation: "上位" },
  ] satisfies Guess[],
};

export const recentGames: RecentGame[] = [
  { title: "第 3 局 · 12 次猜中", status: "已完成", tone: "success" },
  { title: "第 2 局 · 放弃", status: "已放弃", tone: "warning" },
  { title: "第 1 局 · 过期", status: "已过期", tone: "muted" },
];

export const resultBase = {
  answer: "手机",
  aliases: "也接受：智能手机 / 移动电话 / 📱",
  nearMisses: [
    { rank: 1, word: "电话", score: 92, relation: "同类" },
    { rank: 2, word: "平板", score: 76, relation: "同类" },
    { rank: 3, word: "充电器", score: 74, relation: "配件" },
  ] satisfies Guess[],
};
