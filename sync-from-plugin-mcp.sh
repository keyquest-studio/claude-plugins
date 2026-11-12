#!/bin/sh
# One-way copy: plugin-mcp (shared with Codex) -> Claude plugin.
# Reads plugin-mcp only; never writes to it.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../plugin-mcp"
DST="$HERE/plugins/forkflip/server"
cp "$SRC/server.py" "$SRC/requirements.txt" "$DST/"
cp "$SRC/data/"recipes*.json "$DST/data/"
echo "Synced server.py, requirements.txt and recipe data from plugin-mcp."
