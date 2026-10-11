/** 配置能力自测 — scoring + persistence (简体 copy lives in the gate UI). */

export type Choice = "A" | "B" | "C" | "D" | "E";
export type QuestionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6";
export type IntentTier = "high" | "mid" | "low";
export type PathType = "稳健短锁" | "平衡配置" | "长期压舱";

export type QuizAnswers = Record<QuestionId, Choice>;

export type QuizStored = {
  done: true;
  tier: IntentTier;
  path: PathType;
  infoOnly: boolean;
  score: number;
  answers: QuizAnswers;
  at: number;
};

export const QUIZ_STORAGE_KEY = "sfp-config-quiz-done";

export const QUIZ_QUESTIONS: {
  id: QuestionId;
  prompt: string;
  options: { key: Choice; label: string }[];
}[] = [
  {
    id: "Q1",
    prompt: "资金规模",
    options: [
      { key: "A", label: "5万以下" },
      { key: "B", label: "5万–20万" },
      { key: "C", label: "20万–100万" },
      { key: "D", label: "100万以上" },
      { key: "E", label: "暂不确定／只是了解" },
    ],
  },
  {
    id: "Q2",
    prompt: "持有年期",
    options: [
      { key: "A", label: "1年以内" },
      { key: "B", label: "1–3年" },
      { key: "C", label: "3–7年" },
      { key: "D", label: "7年以上／长期压舱" },
      { key: "E", label: "还没想清楚" },
    ],
  },
  {
    id: "Q3",
    prompt: "波动接受度",
    options: [
      { key: "A", label: "几乎不能接受" },
      { key: "B", label: "可接受小幅" },
      { key: "C", label: "中等波动" },
      { key: "D", label: "波动不是问题" },
      { key: "E", label: "不清楚" },
    ],
  },
  {
    id: "Q4",
    prompt: "账户经验",
    options: [
      { key: "A", label: "没有" },
      { key: "B", label: "有美元存款未做过国债" },
      { key: "C", label: "做过基金理财国债是新方向" },
      { key: "D", label: "已有债券或国债经验" },
      { key: "E", label: "不便透露" },
    ],
  },
  {
    id: "Q5",
    prompt: "今天最想解决",
    options: [
      { key: "A", label: "适不适合我" },
      { key: "B", label: "利率窗口怎么看" },
      { key: "C", label: "尽快有人看结构开户路径" },
      { key: "D", label: "需专业确认" },
      { key: "E", label: "随便看看" },
    ],
  },
  {
    id: "Q6",
    prompt: "两周内可否沟通",
    options: [
      { key: "A", label: "方便尽快" },
      { key: "B", label: "可以先看路径图" },
      { key: "C", label: "这两周较忙" },
      { key: "D", label: "只想自学" },
      { key: "E", label: "不确定" },
    ],
  },
];

const SCORE: Record<QuestionId, Record<Choice, number>> = {
  Q1: { A: 1, B: 3, C: 5, D: 6, E: 0 },
  Q2: { A: 1, B: 3, C: 5, D: 5, E: 0 },
  Q3: { A: 1, B: 3, C: 4, D: 5, E: 1 },
  Q4: { A: 2, B: 3, C: 4, D: 5, E: 1 },
  Q5: { A: 2, B: 3, C: 6, D: 5, E: 0 },
  Q6: { A: 6, B: 4, C: 1, D: 0, E: 1 },
};

const TIER_ORDER: IntentTier[] = ["low", "mid", "high"];

function rawScore(answers: QuizAnswers): number {
  return (Object.keys(SCORE) as QuestionId[]).reduce((sum, id) => sum + SCORE[id][answers[id]], 0);
}

function tierFromScore(score: number): IntentTier {
  if (score >= 22) return "high";
  if (score >= 12) return "mid";
  return "low";
}

function shiftTier(tier: IntentTier, delta: -1 | 1): IntentTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(2, Math.max(0, i + delta))]!;
}

export function scoreQuiz(answers: QuizAnswers): {
  score: number;
  tier: IntentTier;
  path: PathType;
  infoOnly: boolean;
} {
  const score = rawScore(answers);
  let tier = tierFromScore(score);

  const bump = answers.Q6 === "A" || ((answers.Q1 === "C" || answers.Q1 === "D") && (answers.Q5 === "C" || answers.Q5 === "D"));
  const drop = answers.Q6 === "D" || (answers.Q1 === "E" && answers.Q5 === "E");
  if (bump) tier = shiftTier(tier, 1);
  if (drop) tier = shiftTier(tier, -1);

  const infoOnly = answers.Q1 === "E" && (answers.Q6 === "C" || answers.Q6 === "D" || answers.Q6 === "E");

  const shortHorizon = answers.Q2 === "A" || answers.Q2 === "B";
  const lowVol = answers.Q3 === "A" || answers.Q3 === "B";
  const longHorizon = answers.Q2 === "C" || answers.Q2 === "D";

  let path: PathType;
  if (shortHorizon && lowVol) path = "稳健短锁";
  else if (longHorizon) path = "长期压舱";
  else path = "平衡配置";

  return { score, tier, path, infoOnly };
}

export function readQuizStored(): QuizStored | null {
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizStored;
    if (!parsed?.done || !parsed.tier || !parsed.path) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeQuizStored(result: Omit<QuizStored, "done" | "at">): QuizStored {
  const stored: QuizStored = { ...result, done: true, at: Date.now() };
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function clearQuizStored(): void {
  localStorage.removeItem(QUIZ_STORAGE_KEY);
}

/** Q1=A（资金规模 5万以下）— do not email owner; low ticket / not worth follow-up. */
export function shouldSkipInquiryEmail(stored?: QuizStored | null): boolean {
  const quiz = stored ?? readQuizStored();
  return quiz?.answers?.Q1 === "A";
}

/** Internal PathType keys stay Simplified for scoring/localStorage compatibility. */
export const PATH_BLURBS: Record<PathType, { title: string; body: string }> = {
  稳健短锁: {
    title: "稳健短锁",
    body: "偏短久期、低波动取向：更适合用短中债做现金替代与确定性票息，先把入场节奏与账户路径理清。",
  },
  平衡配置: {
    title: "平衡配置",
    body: "久期与票息兼顾：可用梯式配置分散再投资风险，再按利率窗口微调长短仓比例。",
  },
  长期压舱: {
    title: "长期压舱",
    body: "偏长久期压舱：更看重跨周期票息与再平衡空间；适合有明确资金闲置周期、能接受市价波动的配置者。",
  },
};

type PathI18n = { title: string; body: string };

const PATH_I18N: Record<PathType, Record<"zh-Hans" | "zh-Hant" | "en", PathI18n>> = {
  稳健短锁: {
    "zh-Hans": {
      title: "稳健短锁",
      body: "偏短久期、低波动取向：更适合用短中债做现金替代与确定性票息，先把入场节奏与账户路径理清。",
    },
    "zh-Hant": {
      title: "穩健短鎖",
      body: "偏短久期、低波動取向：更適合用短中債做現金替代與確定性票息，先把入場節奏與帳戶路徑理清。",
    },
    en: {
      title: "Steady short lock",
      body: "Shorter duration, lower-volatility tilt: use short/intermediate Treasuries as a cash alternative with more predictable coupons, then clarify entry timing and account path.",
    },
  },
  平衡配置: {
    "zh-Hans": {
      title: "平衡配置",
      body: "久期与票息兼顾：可用梯式配置分散再投资风险，再按利率窗口微调长短仓比例。",
    },
    "zh-Hant": {
      title: "平衡配置",
      body: "久期與票息兼顧：可用梯式配置分散再投資風險，再按利率窗口微調長短倉比例。",
    },
    en: {
      title: "Balanced allocation",
      body: "Balance duration and coupon: ladder holdings to spread reinvestment risk, then fine-tune the short/long mix around the rate window.",
    },
  },
  长期压舱: {
    "zh-Hans": {
      title: "长期压舱",
      body: "偏长久期压舱：更看重跨周期票息与再平衡空间；适合有明确资金闲置周期、能接受市价波动的配置者。",
    },
    "zh-Hant": {
      title: "長期壓艙",
      body: "偏長久期壓艙：更看重跨週期票息與再平衡空間；適合有明確資金閒置週期、能接受市價波動的配置者。",
    },
    en: {
      title: "Long-term ballast",
      body: "Longer-duration ballast: prioritise cross-cycle coupons and rebalancing room; suited to capital with a clear idle horizon that can tolerate mark-to-market swings.",
    },
  },
};

export function pathLabel(path: PathType, lang: "zh-Hans" | "zh-Hant" | "en" = "zh-Hans"): string {
  return PATH_I18N[path]?.[lang]?.title ?? PATH_BLURBS[path].title;
}

export function pathBlurbFor(path: PathType, lang: "zh-Hans" | "zh-Hant" | "en" = "zh-Hans"): PathI18n {
  return PATH_I18N[path]?.[lang] ?? PATH_BLURBS[path];
}

export const TIER_LABEL: Record<IntentTier, string> = {
  high: "高意向",
  mid: "中意向",
  low: "初探",
};
