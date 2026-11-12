#!/bin/sh
# Starts the ForkFlip MCP server over stdio.
# stdout belongs to the MCP protocol: every setup message goes to stderr.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVER="$HERE/server.py"

# 1) uv available: run with an ephemeral, cached environment.
if command -v uv >/dev/null 2>&1; then
  exec uv run --quiet --no-project --python ">=3.10" --with-requirements "$HERE/requirements.txt" python "$SERVER"
fi

# 2) Otherwise: a private venv under the user's cache, created once.
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo "ForkFlip plugin needs Python 3.10+ (or uv). Install one and restart Claude." >&2
  exit 1
fi

VENV="${XDG_CACHE_HOME:-$HOME/.cache}/forkflip-claude-plugin/venv"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c 'import mcp' 2>/dev/null; then
  echo "ForkFlip: preparing Python environment in $VENV (first run only)..." >&2
  "$PY" -m venv "$VENV" >&2
  "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check -r "$HERE/requirements.txt" >&2
fi
exec "$VENV/bin/python" "$SERVER"
