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

/** Recharts draw: animate on first in-view and when `dep` changes. */
export function useChartDraw(dep?: unknown): {
  ref: RefObject<HTMLDivElement | null>;
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

  return {
    ref,
    active: inView && !reduced,
    duration: reduced ? 0 : 420,
    key,
  };
}
