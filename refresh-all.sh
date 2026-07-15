#!/usr/bin/env bash
# refresh-all.sh - run the Claude Code /refresh-all command headlessly.
#
# The Claude OAuth token is read from macOS Keychain at runtime and is only
# passed to the child claude process. It is never written to logs.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"
LOG_FILE="$LOGS/refresh-all.log"
SUMMARY_LOG="$LOGS/refresh.log"
CLAUDE_BIN="${HMG_CLAUDE_BIN:-/opt/homebrew/bin/claude}"
SECURITY_BIN="${SECOND_BRAIN_SECURITY_BIN:-/usr/bin/security}"
KEYCHAIN_SERVICE="${SECOND_BRAIN_CLAUDE_TOKEN_SERVICE:-second-brain-claude-code-oauth-token}"
KEYCHAIN_ACCOUNT="${SECOND_BRAIN_CLAUDE_TOKEN_ACCOUNT:-refresh-all}"
CMD="/refresh-all"

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

if [ ! -x "$SECURITY_BIN" ]; then
  echo "$(date '+%F %T') refresh-all: macOS Keychain helper not found at $SECURITY_BIN" >>"$SUMMARY_LOG"
  echo "Missing macOS Keychain helper. Expected executable: $SECURITY_BIN" >>"$LOG_FILE"
  exit 1
fi

if ! CLAUDE_TOKEN="$("$SECURITY_BIN" find-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null)"; then
  echo "$(date '+%F %T') refresh-all: claude oauth token missing from Keychain" >>"$SUMMARY_LOG"
  echo "Claude OAuth token missing. Run 'claude setup-token' and store it in Keychain service '$KEYCHAIN_SERVICE' with account '$KEYCHAIN_ACCOUNT'." >>"$LOG_FILE"
  exit 1
fi

if [ -z "$CLAUDE_TOKEN" ]; then
  echo "$(date '+%F %T') refresh-all: claude oauth token empty in Keychain" >>"$SUMMARY_LOG"
  echo "Claude OAuth token in Keychain is empty. Replace service '$KEYCHAIN_SERVICE' account '$KEYCHAIN_ACCOUNT'." >>"$LOG_FILE"
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
