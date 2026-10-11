import { useMemo, useState } from "react";
import {
  PATH_BLURBS,
  QUIZ_QUESTIONS,
  scoreQuiz,
  writeQuizStored,
  type Choice,
  type PathType,
  type QuestionId,
  type QuizAnswers,
  type QuizStored,
} from "@/lib/config-quiz";

type Step = "intro" | "ask" | "result";

type Props = {
  onComplete: (stored: QuizStored) => void;
};

export function ConfigQuizGate({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Partial<QuizAnswers>>({});
  const [result, setResult] = useState<QuizStored | null>(null);

  const question = QUIZ_QUESTIONS[index]!;
  const progress = step === "ask" ? ((index + 1) / QUIZ_QUESTIONS.length) * 100 : step === "result" ? 100 : 0;

  const finish = (answers: QuizAnswers) => {
    const scored = scoreQuiz(answers);
    const stored = writeQuizStored({ ...scored, answers });
    setResult(stored);
    setStep("result");
  };

  const onPick = (key: Choice) => {
    const id = question.id;
    const next = { ...picks, [id]: key } as Partial<QuizAnswers>;
    setPicks(next);
    if (index < QUIZ_QUESTIONS.length - 1) {
      window.setTimeout(() => setIndex((i) => i + 1), 160);
      return;
    }
    const answers = next as QuizAnswers;
    const complete = QUIZ_QUESTIONS.every((q) => answers[q.id]);
    if (complete) finish(answers);
  };

  const pathBlurb = useMemo(() => {
    if (!result) return null;
    return PATH_BLURBS[result.path as PathType];
  }, [result]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-quiz-title"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-4 py-8 md:px-8 md:py-12">
        <header className="mb-8">
          <p className="sfp-kicker">配置能力自测</p>
          <div className="sfp-progress mt-4" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-faint">
            {step === "ask"
              ? `${index + 1} / ${QUIZ_QUESTIONS.length}`
              : step === "result"
                ? "完成"
                : "准备开始"}
          </p>
        </header>

        {step === "intro" ? (
          <section className="sfp-module p-6 md:p-8">
            <div className="sfp-module-hairline -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8" aria-hidden="true" />
            <h1 id="config-quiz-title" className="font-serif text-3xl text-fg md:text-4xl">
              先花 2 分钟做个配置能力自测
            </h1>
            <p className="mt-4 text-base text-muted">
              完成后你会得到一份「个人化美债路径图」；适合进一步一对一解读的人，可预约银行从业员沟通。
            </p>
            <p className="mt-3 text-sm text-faint">
              共 6 道单选题。同设备完成一次后可直接进入研究室。
            </p>
            <button
              type="button"
              onClick={() => setStep("ask")}
              className="mt-8 h-12 w-full rounded-md bg-accent text-sm font-medium text-accent-fg md:w-auto md:px-8"
            >
              开始自测
            </button>
          </section>
        ) : null}

        {step === "ask" ? (
          <section className="sfp-module p-6 md:p-8">
            <div className="sfp-module-hairline -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8" aria-hidden="true" />
            <h2 id="config-quiz-title" className="font-serif text-2xl text-fg md:text-3xl">
              {question.prompt}
            </h2>
            <div className="mt-6 grid gap-2" role="radiogroup" aria-label={question.prompt}>
              {question.options.map((opt) => {
                const selected = picks[question.id as QuestionId] === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onPick(opt.key)}
                    className={
                      selected
                        ? "rounded-md border border-accent/50 bg-subtle px-4 py-3 text-left text-sm text-fg"
                        : "rounded-md border border-line bg-bg/40 px-4 py-3 text-left text-sm text-muted hover:border-rail hover:text-fg"
                    }
                  >
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-sm border border-line text-xs tabular-nums text-faint">
                      {opt.key}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="mt-6 text-sm text-faint underline-offset-2 hover:underline"
              >
                上一题
              </button>
            ) : null}
          </section>
        ) : null}

        {step === "result" && result && pathBlurb ? (
          <section className="sfp-module p-6 md:p-8">
            <div className="sfp-module-hairline -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8" aria-hidden="true" />
            <p className="sfp-kicker">个人化美债路径图</p>
            <h2 id="config-quiz-title" className="mt-3 font-serif text-3xl text-fg md:text-4xl">
              {pathBlurb.title}
            </h2>
            <p className="mt-4 text-base text-muted">{pathBlurb.body}</p>

            {result.infoOnly ? (
              <p className="mt-4 rounded-md border border-dashed border-line bg-subtle px-4 py-3 text-sm text-muted">
                当前更偏资讯了解。可先浏览研究室内容；若之后想一对一解读开户路径，再预约沟通即可（暂不派单）。
              </p>
            ) : null}

            {result.tier === "high" && !result.infoOnly ? (
              <div className="mt-5 rounded-md border border-accent/35 bg-accent/10 px-4 py-4">
                <p className="text-sm font-medium text-fg">适合进一步一对一解读</p>
                <p className="mt-1 text-sm text-muted">
                  可预约银行从业员沟通香港开户与配置结构。进入研究室后可直接留下联系方式。
                </p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onComplete(result)}
                className="h-12 flex-1 rounded-md bg-accent text-sm font-medium text-accent-fg"
              >
                {result.tier === "high" && !result.infoOnly ? "进入研究室并预约开户沟通" : "进入美国国债研究室"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicks({});
                  setIndex(0);
                  setResult(null);
                  setStep("intro");
                }}
                className="h-12 rounded-md border border-line px-4 text-sm text-muted"
              >
                重新自测
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
