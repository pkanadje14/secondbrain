# Second Brain

An assistant-first "second brain" notes app — a React + Vite UI over an **Obsidian
vault as the single source of truth**, following the LLM-Wiki pattern.

- The **Obsidian vault** is the source of truth (`Second Brain/` folder).
- **Claude Code (CLI)** is the only writer: contributors talk to it, it files app-shaped
  markdown into the vault via the Obsidian MCP, following `Second Brain/CLAUDE.md`.
- A small **Node backend** reads the vault and serves JSON + live-change SSE.
- This **React app** displays it read-only and refreshes live when the vault changes.

```
Contributor ──talk──▶ Claude Code ──Obsidian MCP──▶ vault/Second Brain/*.md
                                                        │ (file watch)
                                   Node backend ◀───────┘
                                        │ /api/state + /api/events (SSE)
                                        ▼
                                   React app (read-only, live)
```

## Team Quickstart

Prerequisites:

- Node.js + npm
- An Obsidian vault with a `Second Brain/` folder, or a vault where the app can create one
- Claude CLI only for `/api/ai` and the optional Claude hooks

Install dependencies and create local env:

```bash
npm install
cd server && npm install
cd ..
npm run setup
```

Each local setup must manually set `VAULT_PATH` in `server/.env` to that
machine's Obsidian vault root. Do not guess this path from usernames, home
directories, or machine defaults:

```dotenv
VAULT_PATH=/absolute/path/to/Obsidian Vault
PORT=8787
# Optional: set only when Claude CLI is not on PATH.
# CLAUDE_BIN=/absolute/path/to/claude
```

`CLAUDE_BIN` is optional unless `/api/ai` should invoke a non-default Claude CLI path.
The frontend uses `/api/ai` through the backend by default; set `VITE_AI_ENDPOINT` in
the root `.env` only when overriding that route.

After `VAULT_PATH` is set, scaffold and verify the vault surface:

```bash
npm run setup:vault
npm run doctor
```

For a demo run, set `VAULT_PATH` to the absolute path for `examples/demo-vault`.

## Run It

Start both processes:

```bash
npm run dev:all
```

The script installs missing dependencies on first run, skips ports that are already
listening, starts logs under `.logs/`, and warns if `server/.env` is missing.

Or start the processes manually. **1) Backend** (reads the vault):

```bash
cd server
npm run dev              # http://localhost:8787  (/api/health, /api/state, /api/events)
```

**2) Frontend**:

```bash
npm run dev              # http://localhost:5173  (reads VITE_API_BASE, default :8787)
npm run build            # production build → dist/
```

Verify the backend:

```bash
curl -sS http://localhost:8787/api/health
```

Open the app at `http://localhost:5173`.

## Optional Claude Hooks

Project hooks in `.claude/settings.json` start the app, pull calendar data, and roll
daily HMG notes through local scripts. When Claude starts outside the repo root, set:

```bash
export SECOND_BRAIN_ROOT=/absolute/path/to/second-brain
```

The hook scripts write logs and daily markers under `.logs/`. They use `claude` from
`PATH` unless `HMG_CLAUDE_BIN` is set.

## Hourly Refresh Automation

`refresh-all.sh` runs the Claude Code `/refresh-all` command headlessly. That command
pulls Google Calendar, saved Slack, and Zoom into the `Second Brain/` vault surface,
then the backend watcher pushes changes to the app.

### Auth

Claude Code auth for this automation uses a long-lived OAuth token from
`claude setup-token`, read from `.env` at runtime by `claude-token.sh` and passed only
to the child `claude` process as `CLAUDE_CODE_OAUTH_TOKEN`. It is never logged, and it
is exported rather than passed on the command line so it does not appear in `ps` output.

Resolution order — first non-empty wins:

1. `SECOND_BRAIN_CLAUDE_TOKEN` in `.env`
2. `SECOND_BRAIN_CLAUDE_TOKEN` in `server/.env`
3. `CLAUDE_CODE_OAUTH_TOKEN` already exported in the environment

`refresh.sh` additionally falls back to the CLI's own stored credentials
(`claude auth status`) when no token is configured, which is what the SessionStart and
SessionEnd hooks use interactively.

Generate and store the token:

```bash
claude setup-token
# paste the token into .env (untracked; .env and .env.* are gitignored):
#   SECOND_BRAIN_CLAUDE_TOKEN=<token>
```

macOS Keychain was used previously and does not work for scheduled runs: a
non-interactive launchd or cron job cannot satisfy a Keychain item's ACL, because there
is no UI to approve the access, so every tick failed at `security find-generic-password`
before Claude started.

### Schedule

```bash
./install-launchd.sh              # hourly agent, idempotent
./install-launchd.sh --uninstall
```

launchd rather than cron: on a laptop that sleeps, a cron tick during sleep is skipped
outright, while `StartInterval` refires once the interval has elapsed after wake. The
agent runs in the `gui` domain because the Claude MCP connectors and the Obsidian REST
endpoint are user-session scoped.

`install-cron.sh` remains for the tiered per-source pulls (`refresh.sh calendar|slack|zoom`).

Verify local automation health:

```bash
npm run doctor
/bin/bash ./refresh-all.sh
launchctl kickstart -p "gui/$(id -u)/com.secondbrain.refresh-all"   # force a run
```

Rotate the token before its expiry by running `claude setup-token` again and replacing
the value in `.env`.

## Troubleshooting

- First setup check — run `npm run doctor`.
- `FATAL: VAULT_PATH is not set` — run `npm run setup` and set `VAULT_PATH` in `server/.env`.
- `FATAL: VAULT_PATH does not exist` — point `VAULT_PATH` at an existing vault root.
- Empty state from `/api/state` — run `npm run setup:vault`.
- Frontend cannot load data — confirm the backend is running on `http://localhost:8787` or set `VITE_API_BASE`.
- `Claude CLI not found` — set `CLAUDE_BIN` in `server/.env` for backend AI calls, or `HMG_CLAUDE_BIN` for hook scripts.
- `Not logged in` from Claude CLI — run `claude auth login`, or use the `.env` token setup above for automation.
- `no Claude token found` from `refresh-all.sh` — run `claude setup-token` and set `SECOND_BRAIN_CLAUDE_TOKEN` in `.env`.
- `SECOND_BRAIN_CLAUDE_TOKEN is set but empty` — the key exists with no value; paste the token or remove the line.
- Failed Claude MCP connectors — reconnect the named Claude MCP/app integrations, then re-run `npm run doctor`.
- `listen EPERM` or watch startup failures — run the dev servers in a local terminal with permissions to bind ports and watch files.

Architecture + the full frontmatter/API contract: `docs/vault-architecture.md`.

## Adding to the Workspace Brain

Use Claude Code with this vault open. It follows `Second Brain/CLAUDE.md`:

- *"Capture a 1:1 with Maya about lifecycle this afternoon"* → writes
  `Second Brain/meetings/<date>-1on1-maya.md`, updates `index.md` + `log.md`,
  ensures `people/maya-chen.md`. The UI updates live.
- *"Ingest today's Slack capture"* → reads `Slack/<date>.md`, files
  app-shaped notes under `Second Brain/notes/`, cross-links them.
- *"Sync calendar / Jira"* → pulls from the Google Calendar / Atlassian MCPs and
  materializes `meetings/` and `tasks/` so the Today page fills in.

The app reads ONLY `Second Brain/`; existing PARA folders stay untouched as
raw source material Claude Code can ingest from.

## What's here

- **Brain** (home) — calm rest state with a greeting, suggestion pills, today's
  daily note, and recents. Ask anything; answers are grounded in workspace notes and
  surface the notes they came from.
- **Today** — Google Calendar meetings on a timeline + Jira tasks. "Ask about the
  day" hands the agenda to the brain.
- **Wiki** — the compounding-knowledge layer, **persisted in the vault** at
  `Second Brain/wiki/` (Overview / Concept / Entity pages with `[[wiki links]]`,
  source backlinks, and the change **Log** from `log.md`). **Ingest** a source →
  the model proposes page edits (creates, updates, contradictions) for reviewer approval →
  real markdown is written to the vault; **Lint** runs a health check and logs it.
  Assistant answers can be **saved as notes** (written to `Second Brain/notes/`).
  Everything compounds across reloads. The Ingest/Lint *proposal* step needs a real
  model via `VITE_AI_ENDPOINT` or the Claude host (the local heuristic brain can't
  return the structured JSON they require); the persistence step is always live.
- **People** — everyone across workspace notes; drill into a person's Slack-style
  profile (title, `@handle`, timezone, description, **prod/stage User IDs** with
  copy buttons) and their project/owner note split.
- **Channels** — Obsidian vault + each Slack channel workspace notes came from.
- **Graph** — a force-directed knowledge graph (notes ↔ people ↔ concepts) with
  search, drag/zoom, and an ask dock that lights up connected nodes.
- **Command palette** (⌘K), a right slide-over **reader**, a **browse** drawer,
  and a settings panel (dark mode + accent) reachable from the header gear.

## The conversational brain

`src/lib/ai.js` is a pluggable client tried in three tiers:

1. `VITE_AI_ENDPOINT` or the default backend `/api/ai` — POST `{ messages }`
   and expect `{ text }` or a string. The default backend invokes the Claude CLI.
2. `window.claude.complete` — used automatically inside Claude's design host.
3. **Local grounded brain** — a zero-config heuristic that answers strictly from
   the notes. Home chat disables this fallback so those answers come from AI.

Set `CLAUDE_BIN=/absolute/path/to/claude` in `server/.env` if the Claude CLI is
not on `PATH`. Set `VITE_AI_ENDPOINT` only when overriding `/api/ai`.

## Structure

```
src/
  data/      notes.js, agenda.js, wiki.js  — mock content (MCP-shaped) + wiki seed/prompts
  lib/       ai.js, brain.jsx, graph.js    — engine: completion, persona/context, graph build
  components/ shared.jsx (icons/helpers), NoteCard, Reader, BrowsePanel, Palette, Tweaks
  pages/     AgendaPage, PeoplePage, ChannelsPage, GraphView, WikiPage
  styles/    colors_and_type.css (Fetch tokens), brain.css (app styles)
  App.jsx    application shell: header, nav, routing, mutations, ask flow
```

Design tokens and the WeGo Sans brand face come straight from the prototype's
`colors_and_type.css`; the fonts live in `public/fonts/`.
