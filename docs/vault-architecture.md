# Second Brain — Obsidian vault as source of truth

Design doc + the shared contract between the vault, the backend, and the frontend.

## Layers

1. **Vault (source of truth)** — configured by `VAULT_PATH`, for example `/absolute/path/to/Obsidian Vault`.
   Existing PARA folders (`1 Projects`, `2 Areas`, `Services`, `Slack`, …) are the
   **raw** layer — never modified by the app. A new `Second Brain/` folder is the
   **surface/wiki** layer, maintained only by Claude Code.
2. **Backend** (`server/`) — reads `Second Brain/**/*.md`, parses frontmatter,
   serves JSON + live-change SSE. Read-only over the vault.
3. **Frontend** (`src/`) — React app fetches the backend; read-only display.

Claude Code (CLI) is the only writer: you talk to it, it writes app-shaped
markdown into `Second Brain/` via the Obsidian MCP, the backend watcher detects
the change, and the UI refreshes live.

## Vault surface layout

```
Second Brain/
  CLAUDE.md          schema + Ingest/Query/Lint workflows
  index.md           catalog by category
  log.md             append-only: "## [YYYY-MM-DD] <op> | <title>"
  notes/<slug>.md    sb_type: note
  people/<slug>.md   sb_type: person
  meetings/<date>-<slug>.md   sb_type: meeting
  daily/<YYYY-MM-DD>.md       sb_type: daily
  tasks/<KEY>.md     sb_type: task
```

## Frontmatter contract (authoritative)

Every surface file carries `sb_type`. Unknown/missing `sb_type` → file ignored by
the app. The backend is permissive: missing optional fields get sane defaults; a
malformed file is skipped and logged, never failing the whole response.

### note
```yaml
---
sb_type: note
id: n-rfd80-landing          # stable id, prefix n-
source: slack                # obsidian | slack   (default obsidian)
channel: "#pack-shop-builders"  # slack only
person: "Shankar Nakai"      # author/owner; legacy "You" normalizes to "Owner"
importance: project          # project | personal   (omit = none)
tags: [shop, landing, rfd]
date: 2026-05-29             # YYYY-MM-DD
pinned: false
done: false
archived: false
read: false                  # true → struck through in the UI (toggle in the reader)
starred: false               # true → appears in Starred notes
title: "RFD-80: New User Landing config"   # falls back to first H1, then filename
preview: "Short one-liner…"                 # falls back to first paragraph
---
<markdown body>
```

### daily
```yaml
---
sb_type: daily
id: daily-2026-05-29
date: 2026-05-29
title: "Friday, May 29"
pinned: true
tasks:
  - { text: "Review eReceipt parser PR", done: true }
  - { text: "Draft experiment brief", done: false }
---
## Focus
…
```
Defaults: `source: obsidian`, `person: Owner`, `importance: personal`, `kind: daily`.

### meeting
```yaml
---
sb_type: meeting
id: m-2026-05-29-standup
date: 2026-05-29
title: "Team standup"
start: "09:30"
end: "09:45"
platform: meet               # meet | zoom
status: accepted             # accepted | tentative | declined
attendees: ["Owner", "Shankar Nakai"]
linkedNotes: ["n-rfd80-landing"]
join: "#"
---
```

### task (Jira-shaped, materialized from Atlassian MCP)
```yaml
---
sb_type: task
key: "FETCH-1242"
date: 2026-05-29
title: "Draft points-expiry experiment brief"
status: "In Progress"        # To Do | In Progress | Done
priority: High               # High | Medium | Low
board: Shop
---
```

### person
```yaml
---
sb_type: person
name: "Shankar Nakai"
initials: "SN"
color: "#2576E9"
role: "Eng"
# Optional Slack-style profile fields (surfaced on the People profile card):
title: "Backend Engineer"        # falls back to role when omitted
handle: "@shankar"
tz: "CT"
desc: "On-call lead for the receipts service."
prodId: "usr_prod_2e5d10"        # legacy single ids (still honored)
stageId: "usr_stg_2e5d10"
# Grouped user IDs (prod/stage × fetch/personal) — each renders as a copyable row:
prodFetchId: "5fcda999b860c21291aa8787"
prodPersonalId: "5fcda999b860c21291aa8787"
stageFetchId: "67ca1d087319a5d4b31d2f9c"
stagePersonalId: "609164600ec71e40f1c2dfd1"
---
```
All profile fields except `name` are optional; only the ID rows that have a value
render (grouped prod then stage). `prodFetchId`/`stageFetchId` fall back to the
legacy `prodId`/`stageId`. The People page lists every `person` file (not just note
authors), so a person with only IDs and no notes still appears in the directory.

## Backend API

### `GET /api/state`
```jsonc
{
  "today": "2026-05-29",          // latest daily date, else system date
  "notes": [ /* note shape, see below */ ],
  "daily": { /* daily shape */ } | null,
  "agenda": { "date": "2026-05-29", "meetings": [ /* meeting */ ], "tasks": [ /* task */ ] },
  "people": { "Shankar Nakai": { "name", "initials", "color", "role", "title"?, "handle"?, "tz"?, "desc"?,
                                  "prodId"?, "stageId"?,
                                  "prodFetchId"?, "prodPersonalId"?, "stageFetchId"?, "stagePersonalId"? }, ... }
}
```

App-shape `note` (what components consume):
```jsonc
{ "id","source","channel"?,"person","importance":"project"|"personal"|null,
  "tags":[],"date","pinned","done","archived","read","starred","title","preview","body" }
```
`daily` adds `kind:"daily"`, `tasks:[{text,done}]`. `meeting` and `task` match their
frontmatter. `people` is a name→profile map used to enrich avatars (`personOf`).

### Wiki layer (`sb_type: wiki`)
Pages live in `Second Brain/wiki/<slug>.md`:
```yaml
---
sb_type: wiki
id: w-<slug>
wiki_type: overview | concept | entity
title: "Shop new-user landing"
updated: 2026-05-29
sources: [n-rfd80-landing]   # note ids
links: ["Offers on Shop"]    # other wiki page titles (backlinks)
---
<markdown body with [[wiki links]]>
```
`/api/state` adds `wiki` (array, mapped `wiki_type`→`type`, overview-first) and
`wikiLog` (parsed from `log.md` lines `## [date] kind | text`, newest first).

### Write endpoints (scoped to `Second Brain/`, path-contained — traversal → 400)
- `POST /api/wiki` `{ title, type, body, links?, sources?, updated? }` → upsert
  `wiki/<slug>.md` (preserves existing `id`/`sources` on merge).
- `POST /api/notes` `{ title, body, tags?, person?, importance?, source? }` →
  create `notes/<slug>-<ts>.md` (`sb_type: note`) — used by "save answer as note".
- `POST /api/notes/star` `{ id, starred }` → update a note's `starred` flag.
- `POST /api/log` `{ kind, text, date? }` → append a line to `log.md`.
The frontend calls these from `vaultClient.js` (`saveWikiPage`/`saveNoteToVault`/
`appendLog`); the chokidar watcher then fires SSE so the UI refreshes. Captured
sources (notes/people/meetings/tasks) remain read-only — only the wiki synthesis,
saved answers, and the log are app-writable.

### `GET /api/events` (SSE)
Emits `event: changed` whenever any file under `Second Brain/` is added/edited/
removed (debounced ~150ms). Client refetches `/api/state`. This is the live
"post in Claude CLI → appears in the UI" path.

Config: `VAULT_PATH` in `server/.env`. Backend serves on `:8787`. Frontend reads
`VITE_API_BASE` (default `http://localhost:8787`).

## Frontend changes (minimal)

- `src/lib/registry.js` — runtime singletons set from the API: `today`, `people`
  map, live `notes`/`daily`. `personOf(name)` (vault profile → fallback hash color),
  `getToday()`. Decouples `shared.jsx`/`brain.jsx`/`ai.js` from the static mock.
- `src/lib/vaultClient.js` — `fetchState()` (calls `setRegistry`), `subscribe(cb)` (SSE).
- `src/hooks/useVault.js` — `{ data, loading, error, reload }`, fetch + SSE subscribe.
- `App.jsx` — sources `notes/daily/agenda/people` from `useVault`; `readOnly` hides
  mutating affordances (pin/archive/done/importance/task-toggle). Loading + error states.
- `AgendaPage` takes `agenda` as a prop instead of importing mock `AGENDA`.

The old `src/data/*.js` mock files remain in the repo as offline fallback but are
no longer imported by the running app.
