#!/usr/bin/env bash
# calendar-pull-hook.sh — on Claude Code SessionStart, pull today's Google Calendar
# into the vault by running `/calendar-to-vault` headlessly. Guards:
#   1) Cascade guard: automated headless children set SB_HOOK_CHILD, so a child's
#      own SessionStart does NOT re-spawn (and won't trip the HMG hook either).
#   2) Once-per-day guard: only the first session of the day pulls the calendar.
# Detached + logged so opening a session never blocks.
set -euo pipefail

# (1) cascade guard.
[ -n "${SB_HOOK_CHILD:-}" ] && exit 0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"
MARKER="$LOGS/.calendar-pull-$(date +%F)"

# (2) once-per-day guard.
[ -f "$MARKER" ] && exit 0
touch "$MARKER"

# `claude` binary overridable for testing (HMG_CLAUDE_BIN=echo …).
CLAUDE_BIN="${HMG_CLAUDE_BIN:-claude}"

# Detached headless run; SB_HOOK_CHILD=1 stops the child's session events from re-spawning.
nohup env SB_HOOK_CHILD=1 "$CLAUDE_BIN" -p "/calendar-to-vault" >>"$LOGS/calendar-pull.log" 2>&1 &
exit 0
