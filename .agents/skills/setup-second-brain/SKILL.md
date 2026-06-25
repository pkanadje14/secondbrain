---
name: setup-second-brain
description: Use when setting up, verifying, or troubleshooting the Second Brain app locally, including VAULT_PATH, backend/frontend dev servers, Claude hooks, and workspace brain setup.
---

# Setup Second Brain

## Read First

- `README.md`
- `server/.env.example`
- `.claude/settings.json`

## Setup Steps

1. Confirm the current working directory is the repo root.
2. Install frontend dependencies with `npm install`.
3. Install backend dependencies with `cd server && npm install`.
4. Create backend env with `npm run setup`.
5. Set `VAULT_PATH=/absolute/path/to/Obsidian Vault` in `server/.env`.
6. Keep `PORT=8787` unless another local service needs that port.
7. Set `CLAUDE_BIN` only when backend `/api/ai` should use a non-default Claude CLI path.
8. Create the app vault surface with `npm run setup:vault`.
9. Check local readiness with `npm run doctor`.
10. Start both dev servers with `npm run dev:all`, or run `cd server && npm run dev` and `npm run dev` in separate terminals.
11. Verify `curl -sS http://localhost:8787/api/health`.
12. Open `http://localhost:5173`.

## Demo Vault

- Use `examples/demo-vault` for screenshots and manual QA.
- Set `VAULT_PATH` to that directory's absolute path in `server/.env`.
- Run `npm run doctor` before opening the app.

## Claude Hooks

- `.claude/settings.json` runs `./start.sh`, `./calendar-pull-hook.sh`, and `./hmg-daily-hook.sh`.
- Set `SECOND_BRAIN_ROOT=/absolute/path/to/second-brain` when hooks run outside the repo root.
- Hook scripts write logs and daily guard files under `.logs/`.
- Hook scripts use `claude` from `PATH` unless `HMG_CLAUDE_BIN` is set.

## Troubleshooting

- `FATAL: VAULT_PATH is not set` means `npm run setup` has not been completed or `server/.env` is incomplete.
- `FATAL: VAULT_PATH does not exist` means the configured vault root is invalid.
- Empty `/api/state` with healthy backend means `npm run setup:vault` has not created readable markdown yet.
- Frontend data failures mean the backend is not reachable at `VITE_API_BASE` or `http://localhost:8787`.
- `Claude CLI not found` affects backend AI calls or hook scripts; set `CLAUDE_BIN` or `HMG_CLAUDE_BIN`.
- `listen EPERM` or watch failures require a local terminal with permission to bind ports and watch files.

## Verification

- Run `cd server && npm test`.
- Run `npm run build`.
- Run setup-script checks against a temp vault when setup flow changes.
- For docs edits, grep tracked files for personal paths and first-person setup wording.
