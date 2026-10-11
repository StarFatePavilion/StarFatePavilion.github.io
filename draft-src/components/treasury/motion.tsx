import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/** Fire once when element enters viewport (or immediately if reduced motion). */
export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12, ...options },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced, inView, options]);

  return [ref, inView];
}

export function Reveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "article" | "header";
}) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const style: CSSProperties | undefined =
    reduced || !delayMs ? undefined : { transitionDelay: `${delayMs}ms` };

  return (
    <Tag
      ref={ref as RefObject<HTMLDivElement>}
      className={`sfp-enter ${inView || reduced ? "sfp-enter-in" : ""} ${className}`.trim()}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Brief tabular flash when `value` string changes. */
export function useNumFlash(value: string): string {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduced) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 400);
    return () => window.clearTimeout(id);
  }, [value, reduced]);

  return flash ? "sfp-num-flash" : "";
}

/** Recharts draw: controllable stroke-dash on first in-view / when `dep` changes.
 *  Recharts isAnimationActive does not expose stroke-dasharray in DOM — we own the draw.
 *  prefers-reduced-motion → instant full line (no dash anim).
 */
export function useChartDraw(dep?: unknown): {
  ref: RefObject<HTMLDivElement | null>;
  /** Always false: disable Recharts built-in; dash anim runs in this hook. */
  active: boolean;
  duration: number;
  key: number;
} {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const [key, setKey] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (!inView || reduced) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setKey((k) => k + 1);
  }, [dep, inView, reduced]);

  useEffect(() => {
    const root = ref.current;
    if (!root || !inView) return;

    const duration = reduced ? 0 : 420;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;

    const paintDash = () => {
      if (cancelled) return;
      const paths = root.querySelectorAll<SVGPathElement>(
        "path.recharts-curve, .recharts-line-curve, .recharts-area-curve",
      );
      for (const el of paths) {
        const strokeAttr = el.getAttribute("stroke");
        if (strokeAttr === "none") continue;
        let len = 0;
        try {
          len = el.getTotalLength();
        } catch {
          continue;
        }
        if (!len || !Number.isFinite(len)) continue;

        el.style.transition = "none";
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = reduced ? "0" : `${len}`;
        void el.getBoundingClientRect();
        if (reduced) continue;
        el.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        el.style.strokeDashoffset = "0";
      }
    };

    // Recharts paints after mount / key remount — double-rAF + short retry
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(paintDash);
      timer = window.setTimeout(paintDash, 48);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [inView, reduced, key, ref]);

  return {
    ref,
    active: false,
    duration: reduced ? 0 : 420,
    key,
  };
}
