import { createServerFn } from "@tanstack/react-start";

const TO = "4kgor@nefu.edu.kg";
const GAP_MS = 30_000;
const recent = new Map<string, number>();
const PATHWAY = "香港开户";

type Inquiry = {
  name: string;
  email: string;
  wechat: string;
  pathway?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

async function rateLimited(): Promise<boolean> {
  let ip = "local";
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    ip = getRequest().headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  } catch {
    ip = "local";
  }
  const now = Date.now();
  const prev = recent.get(ip) ?? 0;
  if (now - prev < GAP_MS) return true;
  recent.set(ip, now);
  return false;
}

export const submitInquiry = createServerFn({ method: "POST" })
  .validator((input: Inquiry) => input)
  .handler(async ({ data }) => {
    const name = data.name.trim().slice(0, 80);
    const email = data.email.trim().slice(0, 120);
    const wechat = data.wechat.trim().slice(0, 64);
    const pathway = (data.pathway || PATHWAY).trim().slice(0, 40);
    const utm = {
      utm_source: (data.utm_source || "").trim().slice(0, 120),
      utm_medium: (data.utm_medium || "").trim().slice(0, 120),
      utm_campaign: (data.utm_campaign || "").trim().slice(0, 120),
      utm_content: (data.utm_content || "").trim().slice(0, 120),
      utm_term: (data.utm_term || "").trim().slice(0, 120),
    };
    const utmFilled = Object.fromEntries(Object.entries(utm).filter(([, v]) => v));
    if (!name || !wechat || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false as const, reason: "send" as const };
    }
    if (await rateLimited()) return { ok: false as const, reason: "wait" as const };
    try {
      const utmLines = Object.entries(utmFilled)
        .map(([k, v]) => `${k}：${v}`)
        .join("\n");
      const res = await fetch(`https://formsubmit.co/ajax/${TO}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: "https://ustreasury2026.grok.me",
          Referer: "https://ustreasury2026.grok.me/",
        },
        body: JSON.stringify({
          name,
          email,
          wechat,
          pathway,
          _replyto: email,
          _subject: `${pathway}查询：${name}${utm.utm_source ? ` [${utm.utm_source}]` : ""}`,
          _template: "table",
          _captcha: "false",
          message: `途径：${pathway}\n名称：${name}\n电邮：${email}\n微信号：${wechat}${utmLines ? `\n\nUTM\n${utmLines}` : ""}`,
          ...utmFilled,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const payload = (await res.json().catch(() => null)) as { success?: string | boolean; message?: string } | null;
      const success = payload?.success === true || payload?.success === "true";
      if (success) return { ok: true as const, reason: "" };
      const activate = /activat/i.test(payload?.message ?? "");
      return { ok: false as const, reason: activate ? ("activate" as const) : ("send" as const) };
    } catch {
      return { ok: false as const, reason: "send" as const };
    }
  });
