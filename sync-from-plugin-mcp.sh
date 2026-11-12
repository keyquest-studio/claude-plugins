#!/bin/sh
# One-way copy: plugin-mcp (shared with Codex) -> Claude plugin.
# Reads plugin-mcp only; never writes to it.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../plugin-mcp"
DST="$HERE/plugins/forkflip/server"
cp "$SRC/server.py" "$DST/"
# Exact pinned versions (directory rule: no version ranges).
cp "$SRC/requirements-lock.txt" "$DST/requirements.txt"
# Compact JSON keeps each file under the directory's 256 KiB limit.
for f in "$SRC/data/"recipes*.json; do
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); open(sys.argv[2],"w",encoding="utf-8").write(json.dumps(d,ensure_ascii=False,separators=(",",":")))' "$f" "$DST/data/$(basename "$f")"
done
echo "Synced server.py, pinned requirements and compact recipe data from plugin-mcp."
