# KeyQuest Studio — Claude plugins

Claude Code plugin marketplace for KeyQuest Studio apps. Currently: **ForkFlip** (`plugins/forkflip`) **Smart Shopping List** (`plugins/smart-shopping`) and **Tzadikim Tombs** (`plugins/tzadikim`).

This folder is separate from `../plugin-mcp` (the Codex/ChatGPT work, its own Git repo). It never writes there.
`sync-from-plugin-mcp.sh` copies the recipe data one way from `plugin-mcp` into `remote-server/data/`. Logic changes in `plugin-mcp/server.py` must be ported to `remote-server/src/catalog.js` and re-tested.

## Try locally (no install)
```
claude --plugin-dir "plugins/forkflip"
```

## Install locally (permanent, for you)
```
claude plugin marketplace add "<path to this folder>"
claude plugin install forkflip@keyquest-studio
```

## Install (for users)
```
claude plugin marketplace add keyquest-studio/claude-plugins
claude plugin install forkflip@keyquest-studio
```
Then start a new Claude Code session.

## Status
- Works: remote MCP server on Cloudflare Workers (`remote-server/`, https://forkflip-mcp.forkflip-mcp.workers.dev/mcp), 5 read-only tools, skill, manifest validation.
- License: proprietary (see LICENSE).
- Deploy server changes: `cd remote-server && node test/parity.mjs` against `npx wrangler dev`, then `npx wrangler deploy`.

## Smart Shopping List plugin
- Remote MCP server: `smart-shopping-server/` (Cloudflare Worker `smart-shopping-mcp`). It wraps the app's live price service
  (Firebase function `mcpGroceryPrices` in the shopping_list repo), adds input limits, drops unpriced products and caches
  each search term at the edge for 6 hours so repeats cost no Firestore reads.
- Install: `claude plugin install smart-shopping@keyquest-studio`.
- Test: `cd smart-shopping-server && npm test`; local run `npx wrangler dev`; deploy `npx wrangler deploy`.

## Tzadikim Tombs plugin
- Remote MCP server: `tzadikim-server/` (Cloudflare Worker `tzadikim-mcp`). Reads the app's public feed
  https://tzadikim-tombs.web.app/tzadikim.json (updated weekly by the app's data pipeline), cached 1 h. No copy of the data here.
- Install: `claude plugin install tzadikim@keyquest-studio`.
- Test: `cd tzadikim-server && npm test`; local run `npx wrangler dev`; deploy `npx wrangler deploy`.
