#!/usr/bin/env bash
# refresh.sh <calendar|slack|zoom|hmg> — run one vault pull headlessly via Claude
# Code. Driven by cron on a tiered cadence (see install-cron.sh). Guards:
#   * SB_HOOK_CHILD=1 so the headless `claude -p` doesn't re-trigger the SessionStart/
#     SessionEnd hooks (calendar/hmg) and cascade.
#   * mkdir lock (atomic, macOS-safe — no flock) so overlapping ticks don't stack;
#     stale locks (>30 min) are reclaimed.
# Cron has a minimal PATH, so the claude binary path is absolute (override with
# HMG_CLAUDE_BIN for tests, e.g. HMG_CLAUDE_BIN=echo).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SRC="${1:?usage: refresh.sh <calendar|slack|zoom|hmg>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"
CLAUDE_BIN="${HMG_CLAUDE_BIN:-/opt/homebrew/bin/claude}"

# shellcheck source=claude-token.sh
. "$ROOT/claude-token.sh"

case "$SRC" in
  calendar) CMD="/calendar-to-vault" ;;
  slack)    CMD="/pull-slack" ;;
  zoom)     CMD="/zoom-to-vault" ;;
  hmg)      CMD="/hmg-daily" ;;
  *) echo "refresh.sh: unknown source '$SRC'" >&2; exit 2 ;;
esac

LOCKDIR="$LOGS/.refresh-$SRC.lock"
# Reclaim a stale lock (process died) older than 30 minutes.
if [ -d "$LOCKDIR" ] && [ -n "$(find "$LOCKDIR" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
  rmdir "$LOCKDIR" 2>/dev/null || true
fi
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "$(date '+%F %T') $SRC: previous run still active — skip" >>"$LOGS/refresh.log"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT

echo "$(date '+%F %T') $SRC: start $CMD" >>"$LOGS/refresh.log"

# Prefer an explicit token so a scheduled run doesn't depend on the interactive
# login; fall back to the CLI's own stored credentials, which is what the
# SessionStart/SessionEnd hooks rely on when no token is configured.
if ! resolve_claude_token "$ROOT"; then
  if ! "$CLAUDE_BIN" auth status 2>/dev/null | grep -q '"loggedIn":[[:space:]]*true'; then
    echo "$(date '+%F %T') $SRC: claude authentication required" >>"$LOGS/refresh.log"
    echo "$CLAUDE_TOKEN_ERROR" >>"$LOGS/refresh-$SRC.log"
    echo "Alternatively run 'claude auth login' on this machine." >>"$LOGS/refresh-$SRC.log"
    exit 1
  fi
fi

# Cap a stuck headless run at 6 min so it never holds the lock indefinitely.
TIMEOUT_BIN="${HMG_TIMEOUT_BIN:-/opt/homebrew/bin/timeout}"
[ -x "$TIMEOUT_BIN" ] || TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

# Export rather than passing `env VAR=val` on the command line: an argv-borne
# token shows up in `ps` output for every process on the box.
export SB_HOOK_CHILD=1
if [ -n "$CLAUDE_TOKEN" ]; then
  export CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN"
fi

run_claude() {
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" 360 "$CLAUDE_BIN" -p "$CMD"
  else
    "$CLAUDE_BIN" -p "$CMD"
  fi
}

run_claude >>"$LOGS/refresh-$SRC.log" 2>&1 || \
  echo "$(date '+%F %T') $SRC: claude timed out or exited non-zero" >>"$LOGS/refresh.log"

echo "$(date '+%F %T') $SRC: done" >>"$LOGS/refresh.log"
