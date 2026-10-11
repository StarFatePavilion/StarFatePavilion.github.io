# Push blocked — 2026-10-11 HKT

## Done locally
- Applied draft-src → /workspace/us-treasury/src
- Built with `GITHUB_PAGES=1 npm run build`
- Synced dist/client → /workspace/sfp-funnel (Pages clone)
- Local commit: `494bd1c08a20ebe615a2ae71e52780159f1c591e` on main (ahead of origin)
- New assets: index-3UvPgcMu.js, routes-BQN6Mbzg.js, styles-IOprGj3U.css, terms-BP1fjGTC.js
- Funnel markers verified in routes bundle: sfp-utm, 了解開戶, 香港开户, inquiry_success

## Blocker
GitHub MCP `user-GitHub-xai` returns **403 Resource not accessible by integration** for:
- push_files, create_or_update_file, create_branch, create_gist
`gh` CLI is not logged in; no GIT credentials for HTTPS push.
Remote `origin/main` still at `08351a8651b84b86015e199baca8f73dba40fcf1`.

## Unblock (user)
1. Re-authorize GitHub connector with **Contents: Read and write** (and metadata), OR
2. `gh auth login` with a PAT that has `repo` scope on this box, then:
   `cd /workspace/sfp-funnel && git push origin main`
3. Do NOT invent GA4/Plausible IDs (hooks are no-ops until IDs added).

## Test URLs after push
- https://starfatepavilion.github.io/?lang=zh-Hans#access
- https://starfatepavilion.github.io/?lang=zh-Hans&utm_source=xhs&utm_medium=social&utm_campaign=hk_open#access
