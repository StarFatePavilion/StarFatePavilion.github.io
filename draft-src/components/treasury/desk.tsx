import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TENORS, yieldOf } from "@/lib/market";
import { money, pct } from "@/lib/money";
import { modifiedDuration } from "@/lib/bonds";
import { DeskState, useDesk, useT } from "@/components/treasury/state";
import { HeroChart } from "@/components/treasury/hero-chart";
import { ShockPanel } from "@/components/treasury/shock-panel";
import { CashflowPanel } from "@/components/treasury/cashflow-panel";
import { BacktestPanel } from "@/components/treasury/backtest-panel";
import { OutlookPanel } from "@/components/treasury/outlook-panel";
import { HoldPanel } from "@/components/treasury/hold-panel";
import { AccessPanel } from "@/components/treasury/access-panel";
import { ConfigQuizGate } from "@/components/treasury/config-quiz-gate";
import { More, Term, useTween } from "@/components/treasury/ui";
import { useInViewOnce, useNumFlash } from "@/components/treasury/motion";
import { clearQuizStored, pathLabel, readQuizStored, type QuizStored } from "@/lib/config-quiz";
import type { YieldPoint } from "@/lib/history";
import type { CurvePayload } from "@/lib/curve";
import type { Lang } from "@/lib/copy";

const LANGS: { id: Lang; label: string }[] = [
  { id: "zh-Hant", label: "繁體" },
  { id: "zh-Hans", label: "简体" },
  { id: "en", label: "EN" },
];

function ladderBook(principal: number, spot: YieldPoint) {
  const tenors = [2, 5, 10, 30] as const;
  const each = principal / tenors.length;
  let semi = 0;
  let interest = 0;
  let dur = 0;
  for (const tenor of tenors) {
    const coupon = yieldOf(spot, tenor);
    semi += (each * coupon) / 100 / 2;
    interest += (each * coupon * tenor) / 100;
    dur += modifiedDuration(coupon / 100, coupon / 100, tenor) * each;
  }
  return { semi, total: principal + interest, dur: principal > 0 ? dur / principal : 0 };
}

export function Desk({ initial }: { initial?: CurvePayload | null }) {
  return (
    <DeskState initial={initial}>
      <DeskShell />
    </DeskState>
  );
}

function DeskShell() {
  const { lang, setLang } = useDesk();
  const [quiz, setQuiz] = useState<QuizStored | null | undefined>(undefined);
  const [jumpAccessOnce, setJumpAccessOnce] = useState(false);

  useEffect(() => {
    setQuiz(readQuizStored());
  }, []);

  if (quiz === undefined) {
    return <div className="min-h-screen bg-bg" aria-busy="true" />;
  }

  if (!quiz) {
    return (
      <ConfigQuizGate
        lang={lang}
        onComplete={(stored) => {
          if (stored.tier === "high" && !stored.infoOnly) {
            setLang("zh-Hans");
            const url = new URL(window.location.href);
            url.hash = "access";
            window.history.replaceState(null, "", `${url.pathname}${url.search}#access`);
            setJumpAccessOnce(true);
          }
          setQuiz(stored);
        }}
      />
    );
  }

  return (
    <DeskView
      quiz={quiz}
      jumpAccessOnce={jumpAccessOnce}
      onJumpAccessHandled={() => setJumpAccessOnce(false)}
      onRetake={() => {
        clearQuizStored();
        setQuiz(null);
      }}
    />
  );
}

function DeskView({
  quiz,
  onRetake,
  jumpAccessOnce = false,
  onJumpAccessHandled,
}: {
  quiz: QuizStored;
  onRetake: () => void;
  jumpAccessOnce?: boolean;
  onJumpAccessHandled?: () => void;
}) {
  const { tenor, setTenor, principal, setPrincipal, ccy, setCcy, lang, setLang, setShockBp, shockBp, spot, asOf, source, weights } = useDesk();
  const t = useT();
  const y = yieldOf(spot, tenor);
  const shownY = useTween(y, 320);
  const [copied, setCopied] = useState(false);
  const [ladder, setLadder] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [activeJump, setActiveJump] = useState("");
  const jumpAccess = useRef(false);
  const openAccess = () => {
    jumpAccess.current = true;
    setLang("zh-Hans");
  };
  const accessCtaLabel = lang === "en" ? "Account opening" : lang === "zh-Hans" ? "了解开户" : "了解開戶";
  useEffect(() => {
    if (!jumpAccess.current || lang !== "zh-Hans") return;
    jumpAccess.current = false;
    document.getElementById("access")?.scrollIntoView({ block: "start" });
  }, [lang]);
  // Deep link: ?lang=zh-Hans#access (panel mounts only after lang flips to zh-Hans)
  useEffect(() => {
    if (lang !== "zh-Hans") return;
    if (window.location.hash !== "#access" && !jumpAccessOnce) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById("access")?.scrollIntoView({ block: "start" });
      onJumpAccessHandled?.();
    });
    return () => window.cancelAnimationFrame(id);
  }, [lang, jumpAccessOnce, onJumpAccessHandled]);
  useEffect(() => {
    const ids = ["cash", "shock", "hold", "backtest", "outlook", "access"];
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!nodes.length) return;
    const ratios = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId = "";
        let best = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > best) {
            best = ratio;
            bestId = id;
          }
        }
        if (bestId) setActiveJump(`#${bestId}`);
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );
    for (const node of nodes) obs.observe(node);
    return () => obs.disconnect();
  }, [lang]);

  const semi = (principal * y) / 100 / 2;
  const interest = (principal * y * tenor) / 100;
  const dur = modifiedDuration(y / 100, y / 100, tenor);
  const flashY = useNumFlash(shownY.toFixed(2));
  const flashP = useNumFlash(money(principal, ccy));
  const flashSemi = useNumFlash(money(semi, ccy, 2));
  const flashTotal = useNumFlash(money(principal + interest, ccy));
  const flashDur = useNumFlash(t.years(dur.toFixed(1)));
  const [veilRef, veilIn] = useInViewOnce<HTMLDivElement>();
  const jumps = [
    ["#cash", t.jumps.cash],
    ["#shock", t.jumps.shock],
    ["#hold", t.jumps.hold],
    ["#backtest", t.jumps.backtest],
    ["#outlook", t.jumps.outlook],
  ] as const;
  const presets = [100_000, 250_000, 1_000_000];

  return (
    <main className="min-h-screen pb-20">
      <header className="mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="sfp-kicker sfp-kicker-latin shrink-0 pt-1">{t.kicker}</p>
          <div className="flex flex-wrap items-center gap-2">
            {lang === "zh-Hans" ? (
              <a
                href="#access"
                className={
                  quiz.tier === "high" && !quiz.infoOnly
                    ? "inline-flex h-8 items-center rounded-md border border-accent/40 bg-accent px-2.5 text-xs font-medium text-accent-fg"
                    : "inline-flex h-8 items-center rounded-md border border-line bg-elevated px-2.5 text-xs font-medium text-fg"
                }
              >
                {quiz.tier === "high" && !quiz.infoOnly ? "预约开户沟通" : accessCtaLabel}
              </a>
            ) : (
              <button type="button" onClick={openAccess} className="inline-flex h-8 items-center rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-fg">
                {quiz.tier === "high" && !quiz.infoOnly ? (lang === "en" ? "Book consult" : "預約開戶溝通") : accessCtaLabel}
              </button>
            )}
            <div className="flex items-center rounded-md border border-line bg-subtle p-0.5" role="group" aria-label={t.langAria}>
            {LANGS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={lang === item.id}
                onClick={() => setLang(item.id)}
                className={
                  lang === item.id
                    ? "inline-flex h-8 items-center rounded px-2.5 text-xs text-fg bg-elevated"
                    : "inline-flex h-8 items-center rounded px-2.5 text-xs text-faint"
                }
              >
                {item.label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                const q = new URLSearchParams();
                q.set("t", String(tenor));
                q.set("p", String(principal));
                q.set("bp", String(shockBp));
                q.set("c", ccy);
                q.set("lang", lang);
                q.set(
                  "w",
                  [weights.ease, weights.firm, weights.slump].map((n) => Math.round(n * 100)).join(","),
                );
                const url = `${window.location.origin}${window.location.pathname}?${q}`;
                navigator.clipboard.writeText(url).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  },
                  () => undefined,
                );
              }}
              className="inline-flex h-8 items-center rounded px-2.5 text-xs text-faint"
            >
              {copied ? t.play.copied : t.play.share}
            </button>
            </div>
          </div>
        </div>
        <h1 className="mt-4 font-serif text-4xl text-fg md:text-5xl">{t.appName}</h1>
        <p className="mt-3 max-w-xl text-base text-muted">{t.lede}</p>
        <p className="mt-3 max-w-xl text-sm text-faint">
          {lang === "en" ? "Your path map: " : lang === "zh-Hans" ? "你的路径图：" : "你的路徑圖："}
          <span className="text-fg">{pathLabel(quiz.path, lang)}</span>
          {quiz.tier === "high" && !quiz.infoOnly ? (
            <>
              {" · "}
              <a href="#access" className="font-medium text-fg underline" onClick={(e) => { if (lang !== "zh-Hans") { e.preventDefault(); openAccess(); } }}>
                {lang === "en" ? "Book 1:1 review / account opening" : lang === "zh-Hans" ? "预约一对一解读 / 开户沟通" : "預約一對一解讀 / 開戶溝通"}
              </a>
            </>
          ) : null}
          {" · "}
          <button type="button" onClick={onRetake} className="underline-offset-2 hover:underline">
            {lang === "en" ? "Retake quiz" : lang === "zh-Hans" ? "重新自测" : "重新自測"}
          </button>
        </p>
        <p className="mt-6 text-xs text-faint">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-up align-middle motion-safe:animate-pulse" />
          {t.asOf(tenor, t.date(asOf))}
        </p>
        <p className={`font-serif text-6xl tabular-nums text-fg md:text-7xl ${flashY}`}>
          {shownY.toFixed(2)}
          <span className="text-3xl text-muted">%</span>
        </p>
        <p className="mt-2 max-w-xl text-xs text-faint">{t.feed[source]}</p>
      </header>

      <div className="sfp-sticky-bar sticky top-0 z-30 mt-6">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 md:px-8">
          <div className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto md:gap-2" role="tablist" aria-label={t.tenorAria}>
            {TENORS.map((item) => {
              const active = item === tenor;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTenor(item)}
                  className={
                    active
                      ? "flex h-11 w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-md bg-accent px-1 text-accent-fg sm:w-auto sm:min-w-[4.5rem] sm:px-2 md:h-12 md:min-w-[5.25rem]"
                      : "flex h-11 w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-md border border-line px-1 text-fg sm:w-auto sm:min-w-[4.5rem] sm:px-2 md:h-12 md:min-w-[5.25rem]"
                  }
                >
                  <span className="text-xs font-medium leading-none md:text-sm">{t.tenor(item)}</span>
                  <span className="mt-1 hidden text-[10px] tabular-nums leading-none opacity-70 sm:block md:text-xs">{pct(yieldOf(spot, item))}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center rounded-md border border-line bg-bg px-2.5 text-xs text-muted md:hidden"
            aria-expanded={navOpen}
            aria-controls="sfp-module-drawer"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? "收起" : "模块"}
          </button>
        </div>
        <nav
          id="sfp-module-drawer"
          className={
            navOpen
              ? "sfp-drawer-sheet mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm md:flex md:flex-nowrap md:overflow-x-auto md:border-t-0 md:bg-transparent md:px-8 md:pb-3 md:pt-0"
              : "mx-auto hidden max-w-6xl items-center gap-4 overflow-x-auto bg-bg px-4 pb-3 text-sm md:flex md:px-8"
          }
          aria-label={t.navAria}
        >
          {jumps.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={
                activeJump === href
                  ? "sfp-nav-active shrink-0 pb-0.5 font-medium text-fg"
                  : "shrink-0 pb-0.5 text-muted"
              }
              onClick={() => setNavOpen(false)}
            >
              {label}
            </a>
          ))}
          {lang === "zh-Hans" ? (
            <a
              href="#access"
              className={
                activeJump === "#access"
                  ? "sfp-nav-active shrink-0 pb-0.5 font-medium text-fg"
                  : "shrink-0 pb-0.5 font-medium text-fg"
              }
              onClick={() => setNavOpen(false)}
            >
              途径 · {accessCtaLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNavOpen(false);
                openAccess();
              }}
              className="shrink-0 font-medium text-fg underline-offset-2 hover:underline"
            >
              {accessCtaLabel}
            </button>
          )}
          <button type="button" onClick={() => setShockBp(0)} className="shrink-0 text-faint md:ml-auto">
            {t.reset}
          </button>
        </nav>
      </div>

      <div className="mx-auto mt-8 max-w-6xl px-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <article className="sfp-rail rounded-md px-4 py-4">
            <p className="text-xs text-faint">{t.principal}</p>
            <p className={`mt-2 font-serif text-2xl tabular-nums text-fg md:text-3xl ${flashP}`}>{money(principal, ccy)}</p>
          </article>
          <article className="sfp-rail rounded-md px-4 py-4">
            <p className="text-xs text-faint">{t.semi}</p>
            <p className={`mt-2 font-serif text-2xl tabular-nums text-fg md:text-3xl ${flashSemi}`}>{money(semi, ccy, 2)}</p>
          </article>
          <article className="sfp-rail rounded-md px-4 py-4">
            <p className="text-xs text-faint">{t.cash.total}</p>
            <p className={`mt-2 font-serif text-2xl tabular-nums text-fg md:text-3xl ${flashTotal}`}>{money(principal + interest, ccy)}</p>
          </article>
          <article className="sfp-rail rounded-md px-4 py-4">
            <p className="text-xs text-faint">
              <Term tip={t.tips.duration}>{t.modDur}</Term>
            </p>
            <p className={`mt-2 font-serif text-2xl tabular-nums text-fg md:text-3xl ${flashDur}`}>{t.years(dur.toFixed(1))}</p>
          </article>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {presets.map((value) => {
            const preview = (value * y) / 100 / 2;
            const active = principal === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPrincipal(value)}
                className={
                  active
                    ? "rounded-md border border-accent/50 bg-subtle px-3 py-3 text-left"
                    : "sfp-rail rounded-md px-3 py-3 text-left"
                }
              >
                <span className="block text-sm font-medium text-fg">{t.preset(value)}</span>
                <span className="mt-1 block text-xs tabular-nums text-muted">{t.presetHint(money(preview, ccy, 2))}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
            <span className="text-faint">{t.principal}</span>
            <input
              type="number"
              min={1000}
              max={100000000}
              step={1000}
              value={principal}
              aria-label={t.principalAria}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) setPrincipal(next);
              }}
              onBlur={() => {
                if (principal < 1000) setPrincipal(1000);
              }}
              className="w-28 bg-transparent text-fg tabular-nums outline-none"
            />
          </label>
          <div className="flex h-11 rounded-md border border-line p-1">
            {(["USD", "HKD"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCcy(item)}
                aria-pressed={ccy === item}
                className={
                  ccy === item
                    ? "rounded-sm bg-accent px-3 text-sm font-medium text-accent-fg"
                    : "px-3 text-sm text-muted"
                }
              >
                {item === "USD" ? t.usd : t.hkd}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            aria-pressed={ladder}
            onClick={() => setLadder((on) => !on)}
            className={
              ladder
                ? "h-11 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg"
                : "h-11 rounded-md border border-line px-3 text-sm text-fg"
            }
          >
            {t.play.ladder}
          </button>
          {ladder ? (
            <p className="mt-3 max-w-2xl text-sm text-muted">
              {t.play.ladderNote(
                money(ladderBook(principal, spot).semi, ccy, 2),
                money(ladderBook(principal, spot).total, ccy),
                t.years(ladderBook(principal, spot).dur.toFixed(1)),
              )}
            </p>
          ) : null}
        </div>

        <p className="mt-6 max-w-2xl text-sm text-muted">{t.intro}</p>
        <More>
          <p>{t.introMore}</p>
        </More>
        <HeroChart />
      </div>

      <div className="mx-auto mt-10 grid min-w-0 max-w-6xl gap-8 px-4 md:px-8">
        <CashflowPanel />
        <ShockPanel />
        <HoldPanel />
        <div className="rounded-md border border-dashed border-line bg-subtle/80 px-4 py-3 text-sm text-muted">
          <span>{lang === "en" ? "Ready to open a Hong Kong account for US Treasuries?" : lang === "zh-Hans" ? "算完持有情景后，想了解怎么开户买美债？" : "算完持有情景後，想了解怎麼開戶買美債？"} </span>
          {lang === "zh-Hans" ? (
            <a href="#access" className="font-medium text-fg underline">
              {accessCtaLabel}（香港开户）
            </a>
          ) : (
            <button type="button" onClick={openAccess} className="font-medium text-fg underline">
              {accessCtaLabel}
            </button>
          )}
        </div>
        <BacktestPanel />
        <OutlookPanel />
        <div className="rounded-md border border-dashed border-line bg-subtle/80 px-4 py-3 text-sm text-muted">
          <span>{lang === "en" ? "Next step: mainland pathways & Hong Kong account opening." : lang === "zh-Hans" ? "看完路径展望，下一步了解开户途径：" : "睇完路徑展望，下一步了解開戶途徑："} </span>
          {lang === "zh-Hans" ? (
            <a href="#access" className="font-medium text-fg underline">
              {accessCtaLabel}（香港开户）
            </a>
          ) : (
            <button type="button" onClick={openAccess} className="font-medium text-fg underline">
              {accessCtaLabel}
            </button>
          )}
        </div>
      </div>

      {lang === "zh-Hans" ? (
        <div
          ref={veilRef}
          className={`sfp-veil-band mt-10 ${veilIn ? "sfp-veil-revealed" : ""}`}
        >
          <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
            <AccessPanel />
          </div>
        </div>
      ) : null}

      <footer className="mx-auto mt-12 max-w-6xl px-4 text-xs text-faint md:px-8">
        {lang !== "zh-Hans" ? (
          <p className="mb-4 text-sm text-muted">
            {lang === "en"
              ? "If you are a mainland client and want to know how to buy US Treasuries, "
              : "如果你是國內客戶，想了解購買美國國債的方法，"}
            <button type="button" onClick={openAccess} className="text-fg underline">
              {lang === "en" ? "click here" : "請點擊這裡"}
            </button>
            {lang === "en" ? "." : "。"}
          </p>
        ) : null}
        <p>{t.footer(t.date(asOf))}</p>
        <p className="mt-3">
          © {new Date().getFullYear()} StarFatePavilion ·{" "}
          {lang === "en" ? "All rights reserved." : lang === "zh-Hans" ? "保留所有权利。" : "保留所有權利。"}{" "}
          <Link to="/terms" className="underline">
            {lang === "en" ? "Terms of use" : lang === "zh-Hans" ? "使用条款" : "使用條款"}
          </Link>
        </p>
      </footer>
    </main>
  );
}
