# Apply draft into local source (still no remote)

```bash
SRC=/workspace/us-treasury/src
DRAFT=/workspace/sfp-funnel/draft-src

cp "$DRAFT/lib/utm.ts" "$SRC/lib/utm.ts"
cp "$DRAFT/lib/inquiry.functions.ts" "$SRC/lib/inquiry.functions.ts"
cp "$DRAFT/components/treasury/state.tsx" "$SRC/components/treasury/state.tsx"
cp "$DRAFT/components/treasury/access-panel.tsx" "$SRC/components/treasury/access-panel.tsx"
cp "$DRAFT/components/treasury/desk.tsx" "$SRC/components/treasury/desk.tsx"

cd /workspace/us-treasury
# npm run build   # when ready; then sync dist → Pages repo
```

Do **not** `git push` / `gh pr create` / MCP `push_files` until user explicitly approves.
