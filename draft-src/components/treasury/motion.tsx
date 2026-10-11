import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefCallback,
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

/** Fire once when element enters viewport (or immediately if reduced motion).
 *  Retries until ref is attached — WhenMounted renders null on first paint.
 */
export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [attached, setAttached] = useState(0);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (inView || reduced) return;
    if (ref.current) {
      setAttached((n) => n + 1);
      return;
    }
    let raf = 0;
    const check = () => {
      if (ref.current) {
        setAttached((n) => n + 1);
        return;
      }
      raf = window.requestAnimationFrame(check);
    };
    raf = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(raf);
  }, [inView, reduced]);

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
  }, [reduced, inView, options, attached]);

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

const CURVE_SEL =
  "path.recharts-curve, .recharts-line-curve, .recharts-area-curve, path.recharts-line-curve";

function paintStrokeDash(root: HTMLElement, reduced: boolean, duration: number) {
  const paths = root.querySelectorAll<SVGPathElement>(CURVE_SEL);
  let painted = 0;
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
    if (reduced) {
      painted += 1;
      continue;
    }
    el.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style.strokeDashoffset = "0";
    painted += 1;
  }
  return painted;
}

/** Recharts draw: controllable stroke-dash on first in-view / when `dep` changes.
 *  Attaches IntersectionObserver only after container ref is real (WhenMounted
 *  starts as null). MutationObserver / ResizeObserver wait for .recharts-line-curve.
 *  prefers-reduced-motion → instant full line (no dash anim).
 */
export function useChartDraw(dep?: unknown): {
  ref: RefCallback<HTMLDivElement>;
  /** Always false: disable Recharts built-in; dash anim runs in this hook. */
  active: boolean;
  duration: number;
  key: number;
} {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [pathsReady, setPathsReady] = useState(0);
  const reduced = usePrefersReducedMotion();
  const [key, setKey] = useState(0);
  const firstDep = useRef(true);
  const duration = reduced ? 0 : 420;

  const setRef = useCallback((el: HTMLDivElement | null) => {
    nodeRef.current = el;
    setNode(el);
  }, []);

  // IntersectionObserver only after container is mounted
  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    if (!node || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, reduced, inView]);

  // Wait for Recharts paths to exist (null frame → SVG later). Once per key.
  useEffect(() => {
    if (!node || !inView) return;
    let armed = true;

    const bump = () => {
      if (!armed) return;
      if (!node.querySelector(CURVE_SEL)) return;
      armed = false;
      setPathsReady((n) => n + 1);
    };

    bump();

    const mo = new MutationObserver(bump);
    mo.observe(node, { childList: true, subtree: true });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(bump)
        : null;
    ro?.observe(node);

    // Recharts often paints a frame after mount / key remount
    const t1 = window.setTimeout(bump, 32);
    const t2 = window.setTimeout(bump, 120);
    const t3 = window.setTimeout(bump, 280);

    return () => {
      armed = false;
      mo.disconnect();
      ro?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [node, inView, key]);

  // Param / tenor change after first view → remount chart so dash can re-run
  useEffect(() => {
    if (!inView) return;
    if (firstDep.current) {
      firstDep.current = false;
      return;
    }
    setKey((k) => k + 1);
  }, [dep, inView]);

  // Paint dash: first in-view and after remount / path appear
  useEffect(() => {
    const root = nodeRef.current;
    if (!root || !inView || pathsReady === 0) return;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;
    let tries = 0;

    const run = () => {
      if (cancelled) return;
      const n = paintStrokeDash(root, reduced, duration);
      if (n === 0 && tries < 8) {
        tries += 1;
        timer = window.setTimeout(run, 40 + tries * 20);
      }
    };

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(run);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [inView, reduced, key, pathsReady, duration]);

  return {
    ref: setRef,
    active: false,
    duration,
    key,
  };
}
