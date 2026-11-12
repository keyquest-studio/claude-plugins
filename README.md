# KeyQuest Studio — Claude plugins

Claude Code plugin marketplace for KeyQuest Studio apps. Currently: **ForkFlip** (`plugins/forkflip`).

This folder is separate from `../plugin-mcp` (the Codex/ChatGPT work, its own Git repo). It never writes there.
`sync-from-plugin-mcp.sh` copies `server.py`, `requirements.txt` and the recipe data one way, from `plugin-mcp` into `plugins/forkflip/server/`. Run it after Codex changes the server, then re-test.

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
- Works: local stdio MCP server, 5 read-only tools, skill, manifest validation.
- License: proprietary (see LICENSE).
- Claude.ai / Claude Desktop users without Claude Code need a remote (HTTPS) MCP connector — the same hosting work that ChatGPT needs (see `../plugin-mcp/REVIEW_PREPARATION.md`). Once hosted, `.mcp.json` can point to the URL instead.
