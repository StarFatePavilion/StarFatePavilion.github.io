/** Capture marketing UTMs from the landing URL and reuse on inquiry submit. */

export type UtmFields = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "sfp-utm";

function empty(): UtmFields {
  return { utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" };
}

/** Read utm_* from the current URL and persist to sessionStorage (first-touch this session). */
export function captureUtmFromUrl(): UtmFields {
  if (typeof window === "undefined") return empty();
  const q = new URLSearchParams(window.location.search);
  const next = empty();
  let found = false;
  for (const key of KEYS) {
    const value = (q.get(key) || "").trim().slice(0, 120);
    if (value) {
      next[key] = value;
      found = true;
    }
  }
  if (found) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
    return next;
  }
  return readStoredUtm();
}

export function readStoredUtm(): UtmFields {
  if (typeof window === "undefined") return empty();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<UtmFields>;
    const out = empty();
    for (const key of KEYS) {
      const value = typeof parsed[key] === "string" ? parsed[key]!.trim().slice(0, 120) : "";
      out[key] = value;
    }
    return out;
  } catch {
    return empty();
  }
}

/** Flatten non-empty UTMs for FormSubmit / analytics props. */
export function utmPayload(utm: UtmFields = readStoredUtm()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of KEYS) {
    if (utm[key]) out[key] = utm[key];
  }
  return out;
}

/** Fire optional success events if Plausible / GA4 / GTM already present. No-op without IDs/scripts. */
export function trackInquirySuccess(extra?: Record<string, string>) {
  if (typeof window === "undefined") return;
  const props = { pathway: "香港开户", ...utmPayload(), ...extra };
  try {
    const w = window as Window & {
      plausible?: (event: string, opts?: { props?: Record<string, string> }) => void;
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    w.plausible?.("inquiry_success", { props });
    w.gtag?.("event", "inquiry_success", props);
    w.dataLayer?.push({ event: "inquiry_success", ...props });
  } catch {
    /* analytics must never break submit UX */
  }
}
