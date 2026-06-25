#!/usr/bin/env bash
# start.sh — boot the Second Brain backend (:8787) and frontend (:5173).
# Idempotent: skips anything already listening; installs deps on first run;
# detaches both servers so this returns immediately (safe for a SessionStart hook).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"

port_up() { lsof -ti "tcp:$1" >/dev/null 2>&1; }

boot() { # name  dir  port  cmd...
  local name="$1" dir="$2" port="$3"; shift 3
  if port_up "$port"; then
    echo "✓ $name already running on :$port"
    return
  fi
  if [ ! -d "$dir/node_modules" ]; then
    echo "… installing $name deps (first run)"
    ( cd "$dir" && npm install >/dev/null 2>&1 )
  fi
  ( cd "$dir" && nohup "$@" >"$LOGS/$name.log" 2>&1 & )
  echo "▶ $name starting on :$port  (logs: .logs/$name.log)"
}

# Backend must exist + have VAULT_PATH configured.
if [ ! -f "$ROOT/server/.env" ]; then
  echo "⚠ server/.env missing — copy server/.env.example and set VAULT_PATH first."
fi

boot backend  "$ROOT/server" 8787 npm run dev
boot frontend "$ROOT"        5173 npm run dev

echo "Second Brain → http://localhost:5173  (API :8787)"
