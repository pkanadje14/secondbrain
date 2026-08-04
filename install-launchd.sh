#!/usr/bin/env bash
# install-launchd.sh [--uninstall] — install the hourly /refresh-all launchd agent.
#
# launchd rather than cron: this is a laptop that sleeps, and a cron tick that
# falls during sleep is skipped outright. StartInterval refires once the interval
# has elapsed after wake, so an hourly refresh survives a closed lid.
#
# The agent runs in the `gui` domain (the logged-in user session) because the
# Claude MCP connectors and the Obsidian REST endpoint are user-session scoped.
#
# Idempotent: re-run to pick up changes to the plist.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.secondbrain.refresh-all"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Uninstalled $LABEL."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/.logs"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$ROOT/refresh-all.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$ROOT</string>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>$ROOT/.logs/launchd-refresh-all.log</string>
    <key>StandardErrorPath</key>
    <string>$ROOT/.logs/launchd-refresh-all.log</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

echo "Installed $LABEL (hourly)."
echo "  status:    launchctl print $DOMAIN/$LABEL | head -20"
echo "  run now:   launchctl kickstart -p $DOMAIN/$LABEL"
echo "  logs:      tail -f $ROOT/.logs/refresh.log"
echo "  uninstall: $ROOT/install-launchd.sh --uninstall"
