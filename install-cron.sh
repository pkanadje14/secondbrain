#!/usr/bin/env bash
# install-cron.sh — install the tiered Second Brain refresh schedule into the local
# crontab (idempotent). Re-run to update; entries are fenced by BEGIN/END markers so
# this never clobbers other crontab lines.
#
# Tiers (only the calendar changes intraday; the rest is sporadic/daily):
#   calendar  every 15 min   — today's Google Calendar → meetings/
#   slack     hourly (:17)   — saved-for-later → notes/
#   zoom      daily 18:05    — recordings + transcripts → zoom/
#   (HMG is handled daily by the SessionEnd hook, not cron.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$ROOT/refresh.sh"
BEGIN="# >>> second-brain refresh (managed) >>>"
END="# <<< second-brain refresh (managed) <<<"

NEW=$(cat <<EOF
$BEGIN
*/15 * * * * /bin/bash "$R" calendar
17 * * * * /bin/bash "$R" slack
5 18 * * * /bin/bash "$R" zoom
$END
EOF
)

# Strip any previous managed block, then append the fresh one.
CURRENT="$(crontab -l 2>/dev/null || true)"
STRIPPED="$(printf '%s\n' "$CURRENT" | sed "/$BEGIN/,/$END/d")"
printf '%s\n%s\n' "$STRIPPED" "$NEW" | sed '/^$/N;/^\n$/D' | crontab -

echo "Installed. Current managed block:"
crontab -l | sed -n "/$BEGIN/,/$END/p"
