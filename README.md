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

Set `VAULT_PATH` in `server/.env` to the vault root:

```dotenv
VAULT_PATH=/absolute/path/to/Obsidian Vault
PORT=8787
CLAUDE_BIN=/opt/homebrew/bin/claude
```

`CLAUDE_BIN` is optional unless `/api/ai` should invoke a non-default Claude CLI path.
The frontend uses `/api/ai` through the backend by default; set `VITE_AI_ENDPOINT` in
the root `.env` only when overriding that route.

Scaffold and verify the vault surface:

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

## Troubleshooting

- First setup check — run `npm run doctor`.
- `FATAL: VAULT_PATH is not set` — run `npm run setup` and set `VAULT_PATH` in `server/.env`.
- `FATAL: VAULT_PATH does not exist` — point `VAULT_PATH` at an existing vault root.
- Empty state from `/api/state` — run `npm run setup:vault`.
- Frontend cannot load data — confirm the backend is running on `http://localhost:8787` or set `VITE_API_BASE`.
- `Claude CLI not found` — set `CLAUDE_BIN` in `server/.env` for backend AI calls, or `HMG_CLAUDE_BIN` for hook scripts.
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

Set `CLAUDE_BIN` in `server/.env` if the Claude CLI is not at
`/opt/homebrew/bin/claude`. Set `VITE_AI_ENDPOINT` only when overriding `/api/ai`.

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
