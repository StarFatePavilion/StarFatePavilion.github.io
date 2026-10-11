# Funnel draft (local only) — StarFatePavilion.github.io

**Status:** draft on disk under `/workspace/sfp-funnel/draft-src/`. No push, no PR, no remote write.

## Source-repo findings

| Location | What |
|---|---|
| GitHub `StarFatePavilion` | **Only 1 public repo:** `StarFatePavilion/StarFatePavilion.github.io` (SPA build output / Pages). |
| Separate SOURCE on GitHub | **None found** (public search + get_me: `public_repos: 1`). |
| Local SOURCE | `/workspace/us-treasury` — Vite + TanStack Start app that builds the site (`src/components/treasury/*`). Not a git remote in this workspace. |
| Live assets | `index.html` → `/assets/index-DOCJGbxP.js` + `/assets/routes-BWK7JuvO.js` + `styles-DY3pU1WZ.css`. |

**Implication:** Safe product changes belong in source (`us-treasury`), then rebuild + copy hashed assets into the Pages repo. Surgical minify-bundle edits are fragile and not the draft path used here.

## Three approved items — draft behavior

### 1) Deep link `?lang=zh-Hans#access` + UTM → FormSubmit

- `state.tsx`: on boot calls `captureUtmFromUrl()` → stores `utm_source|medium|campaign|content|term` in `sessionStorage` key `sfp-utm` (first-touch this session). Existing `?lang=` already applied.
- `desk.tsx`: when `lang === "zh-Hans"` and `location.hash === "#access"`, scrolls `#access` after panel mounts (fixes race: AccessPanel is `null` until zh-Hans).
- `access-panel.tsx` / `inquiry.functions.ts`: FormSubmit JSON includes `pathway: "香港开户"`, all non-empty `utm_*`, richer `_subject` / `message` (`_template: "table"` on client path too).
- Deep-link example: `https://starfatepavilion.github.io/?lang=zh-Hans&utm_source=xhs&utm_medium=social&utm_campaign=hk_open#access`

### 2) Visible CTA「了解開戶」on non-简体 (+ 简体 scroll)

- **Header** (next to lang switcher): button → `openAccess()` (set zh-Hans + scroll); on zh-Hans becomes `#access` link.
- **Sticky nav:** same unlock / link (label 繁`了解開戶` / 简`了解开户` / EN`Account opening`).
- **After Hold panel** and **after Outlook panel:** dashed CTA strips → same unlock / `#access`.
- Footer unlock unchanged. Pathway copy stays **香港开户**.

### 3) Reliable notify + success tracking notes

Notify chain (unchanged architecture, improved payload):

1. Primary: TanStack `submitInquiry` server fn (works on Grok/Vercel-style host; **fails on static GitHub Pages** — expected).
2. Fallback: browser `formsubmit.co/ajax/4kgor@nefu.edu.kg` (this is what Pages actually uses).
3. Activate: if FormSubmit returns Activate message, UI already shows Activate Form instruction — **Inbox Activate still required once** for that recipient.

Success tracking (draft):

- `trackInquirySuccess()` fires **only if** scripts already present:
  - `window.plausible('inquiry_success', { props })`
  - `window.gtag('event', 'inquiry_success', props)`
  - `window.dataLayer.push({ event: 'inquiry_success', ... })`
- **No property ID / domain** → scripts not injected. See `analytics-snippet.html` placeholders. **Blocker for live analytics:** user must provide Plausible domain or GA4 measurement ID (`G-XXXXXXXX`).

## How to ship later (needs user OK)

1. Copy `draft-src/**` over matching paths under `/workspace/us-treasury/src/`.
2. `npm run build` in us-treasury (or project build script).
3. Copy new `dist/client` (or Pages export) hashed assets + `index.html` into `StarFatePavilion.github.io`.
4. User-approved commit + push / PR (not done in this draft).

## Blockers

1. **No source repo on GitHub** — only build-only Pages repo; long-term should publish or private-push `us-treasury`.
2. **Cannot verify rebuild here without running full Vite build + confirming Pages deploy layout** (draft is source-level).
3. **Analytics IDs missing** — Plausible/GA4 events are no-ops until snippet + ID added.
4. **FormSubmit Activate** — first submission from a new browser/domain may require email Activate link.
5. **Server fn on Pages** — Convex/TanStack RPC primary path will keep failing on pure static hosting; FormSubmit fallback is the real notify.

## Files in this draft

```
/workspace/sfp-funnel/draft-src/lib/utm.ts                          (new)
/workspace/sfp-funnel/draft-src/lib/inquiry.functions.ts            (patched)
/workspace/sfp-funnel/draft-src/components/treasury/state.tsx       (patched)
/workspace/sfp-funnel/draft-src/components/treasury/access-panel.tsx (patched)
/workspace/sfp-funnel/draft-src/components/treasury/desk.tsx        (patched)
/workspace/sfp-funnel/draft-src/lib/copy.ts                         (unchanged copy for context)
/workspace/sfp-funnel/draft-notes/FUNNEL_PLAN.md
/workspace/sfp-funnel/draft-notes/analytics-snippet.html
/workspace/sfp-funnel/draft-notes/APPLY.md
```

Cloned Pages tree under `/workspace/sfp-funnel/` left **unmodified** for live assets; drafts are untracked (`?? draft-src/`).
