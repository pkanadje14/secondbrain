# Second Brain Vault Instructions

This folder is the app-facing workspace memory surface. Keep content neutral,
reviewable, and safe to share with the configured workspace.

## Scope
- Write only under this `Second Brain/` folder.
- Treat folders outside `Second Brain/` as raw source material unless a task explicitly asks to ingest them.
- Preserve existing markdown files and frontmatter fields unless updating the same record.

## Capture Rules
- Use `Owner` for the workspace owner/self-owner identity.
- Use real collaborator names only when they appear in source material provided for the workspace.
- Do not store secrets, tokens, passwords, raw credentials, or unnecessary personal data.
- Prefer concise notes with clear `title`, `preview`, `tags`, `date`, and source links.
- Add one append-only line to `log.md` for material wiki or note changes.

## File Types
- `notes/` uses `sb_type: note`.
- `people/` uses `sb_type: person`.
- `meetings/` uses `sb_type: meeting`.
- `daily/` uses `sb_type: daily`.
- `tasks/` uses `sb_type: task`.
- `wiki/` uses `sb_type: wiki`.

See the repo `docs/vault-architecture.md` for the full frontmatter contract.
