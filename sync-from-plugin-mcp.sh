#!/bin/sh
# One-way copy of the recipe data: plugin-mcp (shared with Codex) -> remote-server.
# Reads plugin-mcp only; never writes to it. After syncing: run the parity test, then `npx wrangler deploy` in remote-server.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../plugin-mcp"
DST="$HERE/remote-server/data"
for f in "$SRC/data/"recipes*.json; do
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); open(sys.argv[2],"w",encoding="utf-8").write(json.dumps(d,ensure_ascii=False,separators=(",",":")))' "$f" "$DST/$(basename "$f")"
done
echo "Synced recipe data into remote-server/data. If plugin-mcp/server.py logic changed, port it to remote-server/src/catalog.js too."
