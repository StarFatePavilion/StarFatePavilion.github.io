# 配置能力自测 gate — ready to push (local only)

**Local commit:** `af77833` on `/workspace/sfp-funnel` (NOT pushed).
**Source:** `/workspace/us-treasury`

## Files changed (source)

- `src/lib/config-quiz.ts` — questions, scoring, localStorage `sfp-config-quiz-done`
- `src/components/treasury/config-quiz-gate.tsx` — full-screen 简体 gate UI
- `src/components/treasury/desk.tsx` — `DeskShell` blocks desk until quiz done; path badge + 重新自测; high-intent CTA → `#access`

## Pages tree synced

- `index.html` / `404.html` from `_shell.html`
- `assets/index-4oNbZ8eS.js`, `routes-C4C0O5lm.js`, `styles-BJ1eDqin.css`, `terms-Cm74PB6D.js`
- `curve.json`, `favicon.svg`, `__grok/`

## Retest gate

```js
localStorage.removeItem('sfp-config-quiz-done')
location.reload()
```

Or click **重新自测** under the hero after completing once.

## Behaviour

1. First visit → intro → 6 single-choice Qs → path map (稳健短锁 / 平衡配置 / 长期压舱) → unlock desk
2. Score tiers high/mid/low with force bump/drop; Q1=E + Q6=C/D/E → infoOnly (暂不派单)
3. High intent (not infoOnly) → stronger 预约开户沟通 CTA + scroll `#access` on zh-Hans

## Push

Wait for parent / user explicit push approval. Do not `git push` until then.
