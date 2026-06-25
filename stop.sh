#!/usr/bin/env bash
# stop.sh — stop the Second Brain backend (:8787) and frontend (:5173).
set -euo pipefail

stop_port() { # name port
  local pids; pids="$(lsof -ti "tcp:$2" 2>/dev/null || true)"
  if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; echo "■ stopped $1 (:$2)"; else echo "· $1 not running (:$2)"; fi
}

stop_port frontend 5173
stop_port backend  8787
