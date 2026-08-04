#!/usr/bin/env bash
# claude-token.sh — shared Claude Code credential resolution for the headless
# refresh scripts. Source it, then call `resolve_claude_token <repo-root>`.
#
# Resolution order (first non-empty wins):
#   1. SECOND_BRAIN_CLAUDE_TOKEN in <root>/.env
#   2. SECOND_BRAIN_CLAUDE_TOKEN in <root>/server/.env
#   3. CLAUDE_CODE_OAUTH_TOKEN already exported in the environment
#
# On success sets CLAUDE_TOKEN and CLAUDE_TOKEN_SOURCE (a describable origin, not
# the value) and returns 0. On failure sets CLAUDE_TOKEN_ERROR and returns 1.
# The token value is never printed, logged, or included in any error string.
#
# The .env files are parsed, not sourced: they are untracked operator-edited
# files, and sourcing them would execute their contents and could clobber PATH
# or the lock/log variables the callers depend on.

# Read one KEY=value assignment out of an env file. Prints the value on stdout;
# returns 1 when the file or key is absent.
_sb_read_env_key() {
  local file="$1" key="$2" line value

  [ -f "$file" ] || return 1

  # Last assignment wins, matching how dotenv loaders treat duplicate keys.
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1)" || true
  [ -n "$line" ] || return 1

  value="${line#*=}"

  # Strip CR first: on a CRLF-saved .env the CR lands *outside* the closing
  # quote, so quote-stripping would not match and the token would keep literal
  # quote characters. A stray CR also fails auth with no visible cause.
  value="$(printf '%s' "$value" | tr -d '\r\n')"

  # Strip one matching pair of surrounding quotes.
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac

  printf '%s' "$value"
}

resolve_claude_token() {
  local root="${1:?resolve_claude_token: repo root required}"
  local candidate

  CLAUDE_TOKEN=""
  CLAUDE_TOKEN_SOURCE=""
  CLAUDE_TOKEN_ERROR=""

  local env_file
  for env_file in "$root/.env" "$root/server/.env"; do
    candidate="$(_sb_read_env_key "$env_file" SECOND_BRAIN_CLAUDE_TOKEN)" || continue
    if [ -n "$candidate" ]; then
      CLAUDE_TOKEN="$candidate"
      CLAUDE_TOKEN_SOURCE="SECOND_BRAIN_CLAUDE_TOKEN in $env_file"
      return 0
    fi
    # Key present but empty — keep the distinction for the error message.
    CLAUDE_TOKEN_ERROR="SECOND_BRAIN_CLAUDE_TOKEN is set but empty in $env_file"
  done

  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    CLAUDE_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
    CLAUDE_TOKEN_SOURCE="exported CLAUDE_CODE_OAUTH_TOKEN"
    return 0
  fi

  if [ -z "$CLAUDE_TOKEN_ERROR" ]; then
    CLAUDE_TOKEN_ERROR="no Claude token found. Run 'claude setup-token', then add SECOND_BRAIN_CLAUDE_TOKEN=<token> to $root/.env (untracked)"
  fi
  return 1
}
