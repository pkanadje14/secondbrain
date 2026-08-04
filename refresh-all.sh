#!/usr/bin/env bash
# refresh-all.sh - run the Claude Code /refresh-all command headlessly.
#
# The Claude OAuth token is read from .env at runtime (see claude-token.sh) and
# is only passed to the child claude process. It is never written to logs.
#
# .env rather than Keychain: a scheduled (non-interactive) run cannot satisfy a
# Keychain item's ACL — there is no UI to approve the access — so every cron
# tick failed at `security find-generic-password` before Claude ever started.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"
LOG_FILE="$LOGS/refresh-all.log"
SUMMARY_LOG="$LOGS/refresh.log"
CLAUDE_BIN="${HMG_CLAUDE_BIN:-/opt/homebrew/bin/claude}"
CMD="/refresh-all"

# shellcheck source=claude-token.sh
. "$ROOT/claude-token.sh"

LOCKDIR="$LOGS/.refresh-all.lock"
if [ -d "$LOCKDIR" ] && [ -n "$(find "$LOCKDIR" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
  rmdir "$LOCKDIR" 2>/dev/null || true
fi
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "$(date '+%F %T') refresh-all: previous run still active - skip" >>"$SUMMARY_LOG"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT

echo "$(date '+%F %T') refresh-all: start $CMD" >>"$SUMMARY_LOG"

if ! resolve_claude_token "$ROOT"; then
  echo "$(date '+%F %T') refresh-all: claude token unavailable" >>"$SUMMARY_LOG"
  echo "$CLAUDE_TOKEN_ERROR" >>"$LOG_FILE"
  exit 1
fi

TIMEOUT_BIN="${HMG_TIMEOUT_BIN:-/opt/homebrew/bin/timeout}"
[ -x "$TIMEOUT_BIN" ] || TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

set +e
if [ -n "$TIMEOUT_BIN" ]; then
  SB_HOOK_CHILD=1 CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN" "$TIMEOUT_BIN" 900 "$CLAUDE_BIN" -p "$CMD" >>"$LOG_FILE" 2>&1
  STATUS=$?
else
  SB_HOOK_CHILD=1 CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_TOKEN" "$CLAUDE_BIN" -p "$CMD" >>"$LOG_FILE" 2>&1
  STATUS=$?
fi
set -e
unset CLAUDE_TOKEN

if [ "$STATUS" -eq 0 ]; then
  echo "$(date '+%F %T') refresh-all: done" >>"$SUMMARY_LOG"
  exit 0
fi

if [ -n "$TIMEOUT_BIN" ] && [ "$STATUS" -eq 124 ]; then
  echo "$(date '+%F %T') refresh-all: claude timed out" >>"$SUMMARY_LOG"
else
  echo "$(date '+%F %T') refresh-all: claude exited non-zero ($STATUS)" >>"$SUMMARY_LOG"
fi
exit "$STATUS"
