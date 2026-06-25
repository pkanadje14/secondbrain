# Agent Instructions

## Package Manager
- Root app: `npm install`, `npm run setup`, `npm run setup:vault`, `npm run doctor`, `npm run dev:all`, `npm run build`
- Backend: `cd server && npm install`, `cd server && npm run dev`, `cd server && npm test`

## Tech Stack
- React 18 + Vite 6
- Express backend in `server/`
- Markdown/frontmatter parsing with `gray-matter`
- Obsidian vault data under `VAULT_PATH/Second Brain/`

## Architecture
- Backend reads vault markdown and serves `/api/state`.
- Frontend consumes `/api/state` through `src/lib/vaultClient.js`.
- Writes stay scoped to `Second Brain/` through backend endpoints.
- `person: You` is legacy input; API/UI normalize it to `Owner`.

## Setup
- Configure backend env with `npm run setup`.
- Stop setup until the local user manually provides the Obsidian vault root.
- Do not guess `VAULT_PATH` from usernames, home directories, or machine defaults.
- Set `VAULT_PATH=/absolute/path/to/Obsidian Vault` in `server/.env`.
- Create `Second Brain/` with `npm run setup:vault`.
- Check local readiness with `npm run doctor`.
- Start both dev servers with `npm run dev:all`, or run backend and frontend manually.
- Verify backend health with `curl -sS http://localhost:8787/api/health`.
- Set `SECOND_BRAIN_ROOT=/absolute/path/to/second-brain` when Claude hooks run outside the repo root.

## Local Skills
- Setup flow: `.agents/skills/setup-second-brain/SKILL.md`

## Conventions
- Keep persisted schema fields compatible with existing vault files.
- Use `Owner` for neutral self-owner display.
- Keep `importance: personal` as a stored enum; render it as `Owner`.
- Avoid machine-specific paths in tracked files.
- Do not log or commit vault content, tokens, or personal identifiers.

## Testing
- Run backend tests: `cd server && npm test`
- Run frontend build: `npm run build`
- Verify setup scripts with a temp `VAULT_PATH` when changing setup flow.
- After copy changes, grep tracked files for personal paths and user-facing first-person wording.

## Commits
- Use Conventional Commits when committing.
- Do not add `Co-Authored-By` trailers.
