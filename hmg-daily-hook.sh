#!/usr/bin/env bash
# hmg-daily-hook.sh — on Claude Code SessionEnd, roll today's session work into the
# current week's HMG by running `/hmg-daily` headlessly. Two guards keep it safe:
#   1) Recursion guard: the headless `claude -p` we spawn fires its OWN SessionEnd.
#      It runs with HMG_DAILY_RUN=1 in env, so that child's hook no-ops here.
#   2) Once-per-day guard: only the first session-end of the day triggers a run.
# Detached + logged so quitting a session never blocks.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# (1) recursion/cascade guard — any automated headless child sets SB_HOOK_CHILD, so
# neither this hook nor the calendar hook re-spawns from a child's session events.
[ -n "${SB_HOOK_CHILD:-}${HMG_DAILY_RUN:-}" ] && exit 0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"; mkdir -p "$LOGS"
MARKER="$LOGS/.hmg-daily-$(date +%F)"

# (2) once-per-day guard.
[ -f "$MARKER" ] && exit 0
touch "$MARKER"

# `claude` binary is overridable for testing (HMG_CLAUDE_BIN=echo …).
CLAUDE_BIN="${HMG_CLAUDE_BIN:-claude}"

# Detached headless run; HMG_DAILY_RUN=1 trips the recursion guard in its SessionEnd.
nohup env HMG_DAILY_RUN=1 "$CLAUDE_BIN" -p "/hmg-daily" >>"$LOGS/hmg-daily.log" 2>&1 &
exit 0
