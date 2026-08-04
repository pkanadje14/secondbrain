import "dotenv/config";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import express from "express";
import cors from "cors";
import chokidar from "chokidar";
import matter from "gray-matter";
import { normalizePersonName } from "./lib/identity.js";
import { parseFile, buildState, slugify } from "./lib/parse.js";

const VAULT_PATH = process.env.VAULT_PATH;
const PORT = Number(process.env.PORT) || 8787;
const SCOPE_FOLDER = "Second Brain";
const CLAUDE_BIN = process.env.CLAUDE_BIN || process.env.HMG_CLAUDE_BIN || "/opt/homebrew/bin/claude";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 90_000;
const AI_PROMPT_MAX = Number(process.env.AI_PROMPT_MAX) || 120_000;
const execFileAsync = promisify(execFile);
const CLAUDE_AUTH_ERROR = "Claude CLI is installed but not authenticated. Run `claude auth login` or `claude setup-token` on this machine.";

if (!VAULT_PATH) {
  console.error(
    "FATAL: VAULT_PATH is not set. Copy .env.example to .env and set VAULT_PATH to the Obsidian vault path."
  );
  process.exit(1);
}
if (!fs.existsSync(VAULT_PATH)) {
  console.error(`FATAL: VAULT_PATH does not exist: ${VAULT_PATH}`);
  process.exit(1);
}

const scopeRoot = path.join(VAULT_PATH, SCOPE_FOLDER);
const anthropicNewsStatePath = path.join(scopeRoot, ".state", "anthropic-news.json");

function systemToday() {
  return new Date().toISOString().slice(0, 10);
}

function emptyState() {
  const today = systemToday();
  return {
    today,
    notes: [],
    daily: null,
    agenda: { date: today, meetings: [], weekMeetings: [], tasks: [] },
    people: {},
    wiki: [],
    wikiLog: [],
    hmg: [],
    zoom: [],
    anthropicNews: null,
  };
}

async function collectMarkdownFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`loadAll: cannot read directory ${dir}: ${err.message}`);
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

async function readAnthropicNewsState() {
  try {
    const raw = await fsp.readFile(anthropicNewsStatePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      checkedAt: parsed.checkedAt || null,
      signature: parsed.signature || null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`loadAll: cannot read Anthropic News state: ${err.message}`);
    }
    return null;
  }
}

async function loadAll() {
  if (!fs.existsSync(scopeRoot)) {
    console.warn(
      `loadAll: "${SCOPE_FOLDER}/" folder not found at ${scopeRoot} — serving empty state. Create it (Claude Code writes here) to populate the app.`
    );
    return emptyState();
  }

  const filePaths = await collectMarkdownFiles(scopeRoot);
  const parsed = [];
  for (const absPath of filePaths) {
    try {
      const raw = await fsp.readFile(absPath, "utf8");
      const result = parseFile(absPath, raw);
      if (result) parsed.push(result);
    } catch (err) {
      console.warn(`loadAll: skipping ${absPath}: ${err.message}`);
    }
  }

  let logRaw = "";
  try {
    logRaw = await fsp.readFile(path.join(scopeRoot, "log.md"), "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`loadAll: cannot read log.md: ${err.message}`);
    }
  }

  const anthropicNews = await readAnthropicNewsState();
  return { ...buildState(parsed, systemToday(), logRaw), anthropicNews };
}

// Reject obvious path-traversal / absolute-path attempts in raw user input
// before it is slugified. Slugify already strips these, but failing fast here
// makes the boundary explicit and returns a clear 400.
function hasTraversal(value) {
  const s = String(value ?? "");
  return s.includes("..") || s.includes("/") || s.includes("\\") || path.isAbsolute(s);
}

// Resolve a vault-relative target inside `subdir`, rejecting path traversal.
// Returns the absolute path, or null when the input would escape the subdir.
function safeTargetPath(subdir, fileName) {
  const dir = path.join(scopeRoot, subdir);
  const target = path.join(dir, fileName);
  const resolvedDir = path.resolve(dir);
  if (!path.resolve(target).startsWith(resolvedDir + path.sep)) return null;
  return target;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, vault: scopeRoot, exists: fs.existsSync(scopeRoot) });
});

app.get("/api/state", async (_req, res) => {
  try {
    const state = await loadAll();
    res.json(state);
  } catch (err) {
    console.error(`/api/state failed: ${err.message}`);
    res.status(500).json({ error: "failed to build state" });
  }
});

function normalizeChatMessages(value) {
  if (!Array.isArray(value)) return null;
  const messages = value
    .map((message) => ({
      role: String(message?.role ?? "").trim().toLowerCase(),
      content: String(message?.content ?? "").trim(),
    }))
    .filter((message) => message.role && message.content);

  if (messages.length === 0) return null;
  return messages;
}

function formatClaudePrompt(messages) {
  return [
    "Answer the final USER message using the conversation context below.",
    "Return only the assistant response.",
    "",
    ...messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`),
  ].join("\n\n");
}

function summarizeClaudeFailure(err) {
  if (err.code === "ENOENT") {
    return `Claude CLI not found at ${CLAUDE_BIN}; set CLAUDE_BIN in server/.env`;
  }

  const output = [err.stdout, err.stderr, err.message]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");

  if (output.includes("Not logged in")) {
    return CLAUDE_AUTH_ERROR;
  }

  return err.message;
}

app.post("/api/ai", async (req, res) => {
  const messages = normalizeChatMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  const prompt = formatClaudePrompt(messages);
  if (prompt.length > AI_PROMPT_MAX) {
    return res.status(413).json({ error: `AI prompt exceeds ${AI_PROMPT_MAX} characters` });
  }

  try {
    const { stdout } = await execFileAsync(CLAUDE_BIN, ["-p", prompt], {
      timeout: AI_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, SB_HOOK_CHILD: "1" },
    });
    const text = stdout.trim();
    if (!text) {
      return res.status(502).json({ error: "AI returned an empty response" });
    }
    return res.json({ text });
  } catch (err) {
    const timedOut = err.killed || err.signal === "SIGTERM";
    const status = timedOut ? 504 : 502;
    const detail = timedOut ? "AI request timed out" : summarizeClaudeFailure(err);
    console.error(`POST /api/ai failed: ${detail}`);
    return res.status(status).json({ error: timedOut ? "AI request timed out" : "AI request failed", detail });
  }
});

// --- Write endpoints (scoped, path-contained) -------------------------------
// Writes land in Second Brain/<subdir>/; the chokidar watcher (below) detects
// them and pushes `changed` to SSE clients — no manual broadcast here.

const PREVIEW_MAX = 140;

function vaultRelative(absPath) {
  return path.relative(scopeRoot, absPath);
}

// Append-only operation log. Shared by every write endpoint so the vault keeps a
// single human-readable trail under Second Brain/log.md.
async function appendVaultLog(kind, text, date) {
  const logPath = path.join(scopeRoot, "log.md");
  if (!fs.existsSync(logPath)) {
    await fsp.mkdir(scopeRoot, { recursive: true });
    await fsp.writeFile(
      logPath,
      "# Log — Second Brain surface\n\nAppend-only. One line per operation.\n",
      "utf8"
    );
  }
  const line = `\n## [${date || systemToday()}] ${kind} | ${text}\n`;
  await fsp.appendFile(logPath, line, "utf8");
}

// Locate a note's source file by its frontmatter id. The id is matched against
// parsed frontmatter — never used as a filename — so there is no path-traversal
// surface even though the value comes from the client.
async function findNoteFileById(id) {
  const files = await collectMarkdownFiles(scopeRoot);
  for (const absPath of files) {
    try {
      const fm = matter(await fsp.readFile(absPath, "utf8"));
      if (fm.data?.sb_type === "note" && String(fm.data?.id ?? "") === String(id)) {
        return { absPath, fm };
      }
    } catch {
      /* skip unreadable file */
    }
  }
  return null;
}

// Locate a daily note's source file by its frontmatter id. Daily tasks live in
// frontmatter, so task toggles update the daily file directly.
async function findDailyFileById(id) {
  const files = await collectMarkdownFiles(scopeRoot);
  for (const absPath of files) {
    try {
      const fm = matter(await fsp.readFile(absPath, "utf8"));
      if (fm.data?.sb_type === "daily" && String(fm.data?.id ?? "") === String(id)) {
        return { absPath, fm };
      }
    } catch {
      /* skip unreadable file */
    }
  }
  return null;
}

// Locate a zoom artifact's source file by its frontmatter id. Like
// findNoteFileById, the id is matched against parsed frontmatter — never used
// as a filename — so there is no path-traversal surface.
async function findZoomFileById(id) {
  const files = await collectMarkdownFiles(scopeRoot);
  for (const absPath of files) {
    try {
      const fm = matter(await fsp.readFile(absPath, "utf8"));
      if (fm.data?.sb_type === "zoom" && String(fm.data?.id ?? "") === String(id)) {
        return { absPath, fm };
      }
    } catch {
      /* skip unreadable file */
    }
  }
  return null;
}

app.post("/api/wiki", async (req, res) => {
  try {
    const { title, type, body, links, sources, updated } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    // Wiki titles are free text. Only the slug-derived filename is used as the
    // path segment, then safeTargetPath validates the write stays in wiki/.
    const slug = slugify(title);
    if (!slug) return res.status(400).json({ error: "title slugifies to empty" });

    const slugTarget = safeTargetPath("wiki", `${slug}.md`);
    if (!slugTarget) return res.status(400).json({ error: "invalid target path" });

    // Upsert by TITLE, not filename: an existing page may live under a filename
    // that doesn't equal slug(title) (e.g. a hand-named seed). Matching on title
    // updates that file in place instead of creating a duplicate.
    const wikiDir = path.dirname(slugTarget);
    let target = slugTarget;
    let existing = null;
    try {
      const files = await fsp.readdir(wikiDir);
      for (const f of files) {
        if (!f.endsWith(".md")) continue;
        const fp = path.join(wikiDir, f);
        try {
          const fm = matter(await fsp.readFile(fp, "utf8"));
          if (fm.data?.sb_type === "wiki" && String(fm.data?.title ?? "").toLowerCase() === title.toLowerCase()) {
            target = fp;
            existing = fm;
            break;
          }
        } catch { /* skip unreadable file */ }
      }
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    if (!existing) {
      try {
        existing = matter(await fsp.readFile(target, "utf8"));
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    }

    const data = {
      sb_type: "wiki",
      id: existing?.data?.id ?? `w-${slug}`,
      wiki_type: type || existing?.data?.wiki_type || "concept",
      title,
      updated: updated || systemToday(),
      sources:
        sources !== undefined ? sources : existing?.data?.sources ?? [],
      links: links !== undefined ? links : existing?.data?.links ?? [],
    };
    const content =
      body !== undefined && body !== null ? String(body) : existing?.content ?? "";

    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, matter.stringify(content, data), "utf8");

    res.json({ ok: true, id: data.id, path: vaultRelative(target) });
  } catch (err) {
    console.error(`POST /api/wiki failed: ${err.message}`);
    res.status(500).json({ error: "failed to write wiki page" });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const { title, body, tags, person, importance, source } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    if (hasTraversal(title)) {
      return res.status(400).json({ error: "title contains path separators" });
    }
    const slug = slugify(title);
    if (!slug) return res.status(400).json({ error: "title slugifies to empty" });

    const now = Date.now();
    const shortTs = String(now).slice(-6);
    const target = safeTargetPath("notes", `${slug}-${shortTs}.md`);
    if (!target) return res.status(400).json({ error: "invalid target path" });

    const bodyStr = body !== undefined && body !== null ? String(body) : "";
    const data = {
      sb_type: "note",
      id: `n-saved-${now}`,
      source: source || "obsidian",
      person: normalizePersonName(person),
      tags: tags ?? ["synthesis"],
      date: systemToday(),
      pinned: false,
      done: false,
      archived: false,
      starred: false,
      title,
      preview: bodyStr.slice(0, PREVIEW_MAX),
    };
    if (importance) data.importance = importance;

    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, matter.stringify(bodyStr, data), "utf8");

    res.json({ ok: true, id: data.id, path: vaultRelative(target) });
  } catch (err) {
    console.error(`POST /api/notes failed: ${err.message}`);
    res.status(500).json({ error: "failed to write note" });
  }
});

app.post("/api/log", async (req, res) => {
  try {
    const { kind, text, date } = req.body ?? {};
    if (!kind || typeof kind !== "string") {
      return res.status(400).json({ error: "kind is required" });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    await appendVaultLog(kind, text, date);

    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/log failed: ${err.message}`);
    res.status(500).json({ error: "failed to append log" });
  }
});

// Toggle a note's archived state in place. Finds the file by frontmatter id,
// flips `archived`, and rewrites — the chokidar watcher then refreshes clients.
app.post("/api/notes/archive", async (req, res) => {
  try {
    const { id, archived } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (typeof archived !== "boolean") {
      return res.status(400).json({ error: "archived must be a boolean" });
    }

    const found = await findNoteFileById(id);
    if (!found) return res.status(404).json({ error: "note not found" });

    const data = { ...found.fm.data, archived };
    await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");
    await appendVaultLog("archive", `${id} → ${archived ? "archived" : "unarchived"}`);

    res.json({ ok: true, id, archived, path: vaultRelative(found.absPath) });
  } catch (err) {
    console.error(`POST /api/notes/archive failed: ${err.message}`);
    res.status(500).json({ error: "failed to update note" });
  }
});

// Toggle a note's read state in place (renders as strikethrough in the UI).
// Same pattern as archive: find by frontmatter id, flip `read`, rewrite.
app.post("/api/notes/read", async (req, res) => {
  try {
    const { id, read } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (typeof read !== "boolean") {
      return res.status(400).json({ error: "read must be a boolean" });
    }

    const found = await findNoteFileById(id);
    if (!found) return res.status(404).json({ error: "note not found" });

    const data = { ...found.fm.data, read };
    await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");
    await appendVaultLog("read", `${id} → ${read ? "read" : "unread"}`);

    res.json({ ok: true, id, read, path: vaultRelative(found.absPath) });
  } catch (err) {
    console.error(`POST /api/notes/read failed: ${err.message}`);
    res.status(500).json({ error: "failed to update note" });
  }
});

// Toggle a note's starred state in place. Finds the file by frontmatter id,
// flips `starred`, and rewrites so the Starred drawer survives refreshes.
app.post("/api/notes/star", async (req, res) => {
  try {
    const { id, starred } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (typeof starred !== "boolean") {
      return res.status(400).json({ error: "starred must be a boolean" });
    }

    const found = await findNoteFileById(id);
    if (!found) return res.status(404).json({ error: "note not found" });

    const data = { ...found.fm.data, starred };
    await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");
    await appendVaultLog("star", `${id} → ${starred ? "starred" : "unstarred"}`);

    res.json({ ok: true, id, starred, path: vaultRelative(found.absPath) });
  } catch (err) {
    console.error(`POST /api/notes/star failed: ${err.message}`);
    res.status(500).json({ error: "failed to update note" });
  }
});

// Locate a person's profile file by frontmatter name (exact match). Like the
// note/zoom lookups, the name is matched against parsed frontmatter — never used
// as a filename — so there is no path-traversal surface here.
async function findPersonFileByName(name) {
  const files = await collectMarkdownFiles(scopeRoot);
  for (const absPath of files) {
    try {
      const fm = matter(await fsp.readFile(absPath, "utf8"));
      if (fm.data?.sb_type === "person" && String(fm.data?.name ?? "") === String(name)) {
        return { absPath, fm };
      }
    } catch {
      /* skip unreadable file */
    }
  }
  return null;
}

// Hide/show a person in the People list. People are derived (note authors) or
// backed by a profile file. If a profile file exists, flip `hidden` in place;
// otherwise create a minimal stub under people/ to carry the flag (only when
// hiding — there's nothing to "show" for a person with no file).
app.post("/api/people/hide", async (req, res) => {
  try {
    const { name, hidden } = req.body ?? {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    if (typeof hidden !== "boolean") {
      return res.status(400).json({ error: "hidden must be a boolean" });
    }

    const found = await findPersonFileByName(name);
    if (found) {
      const data = { ...found.fm.data, hidden };
      await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");
      await appendVaultLog("hide-person", `${name} → ${hidden ? "hidden" : "shown"}`);
      return res.json({ ok: true, name, hidden, path: vaultRelative(found.absPath) });
    }

    if (!hidden) return res.status(404).json({ error: "person not found" });
    if (hasTraversal(name)) {
      return res.status(400).json({ error: "name contains path separators" });
    }
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ error: "name slugifies to empty" });
    const target = safeTargetPath("people", `${slug}.md`);
    if (!target) return res.status(400).json({ error: "invalid target path" });

    const data = { sb_type: "person", name, hidden: true };
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, matter.stringify("", data), "utf8");
    await appendVaultLog("hide-person", `${name} → hidden`);
    res.json({ ok: true, name, hidden: true, path: vaultRelative(target) });
  } catch (err) {
    console.error(`POST /api/people/hide failed: ${err.message}`);
    res.status(500).json({ error: "failed to update person" });
  }
});

// Toggle a single daily note task's done state in place. Finds the daily file by
// frontmatter id, flips tasks[index].done, and rewrites the file.
app.post("/api/daily/task", async (req, res) => {
  try {
    const { id, index, done } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (!Number.isInteger(index)) {
      return res.status(400).json({ error: "index must be an integer" });
    }
    if (typeof done !== "boolean") {
      return res.status(400).json({ error: "done must be a boolean" });
    }

    const found = await findDailyFileById(id);
    if (!found) return res.status(404).json({ error: "daily note not found" });

    const tasks = Array.isArray(found.fm.data?.tasks) ? found.fm.data.tasks : [];
    if (index < 0 || index >= tasks.length) {
      return res.status(400).json({ error: "index out of range" });
    }

    const nextTasks = tasks.map((task, i) =>
      i === index ? { ...task, done } : task
    );
    const data = { ...found.fm.data, tasks: nextTasks };
    await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");

    const title = found.fm.data?.title ?? id;
    const text = `${title} task ${done ? "done" : "reopened"}: ${tasks[index]?.text ?? ""}`;
    await appendVaultLog("daily", text);

    res.json({ ok: true, id, index, done, path: vaultRelative(found.absPath) });
  } catch (err) {
    console.error(`POST /api/daily/task failed: ${err.message}`);
    res.status(500).json({ error: "failed to update daily task" });
  }
});

// Toggle a single zoom to-do's done state in place. Finds the file by
// frontmatter id, flips todos[index].done, and rewrites — the chokidar watcher
// then refreshes clients. The index is validated against the file's todos array.
app.post("/api/zoom/todo", async (req, res) => {
  try {
    const { id, index, done } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id is required" });
    }
    if (!Number.isInteger(index)) {
      return res.status(400).json({ error: "index must be an integer" });
    }

    const found = await findZoomFileById(id);
    if (!found) return res.status(404).json({ error: "zoom not found" });

    const todos = Array.isArray(found.fm.data?.todos) ? found.fm.data.todos : [];
    if (index < 0 || index >= todos.length) {
      return res.status(400).json({ error: "index out of range" });
    }

    const nextTodos = todos.map((todo, i) =>
      i === index ? { ...todo, done: !!done } : todo
    );
    const data = { ...found.fm.data, todos: nextTodos };
    await fsp.writeFile(found.absPath, matter.stringify(found.fm.content, data), "utf8");

    const title = found.fm.data?.title ?? id;
    const text = `${title} todo ${done ? "done" : "reopened"}: ${todos[index]?.text ?? ""}`;
    await appendVaultLog("zoom", text);

    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/zoom/todo failed: ${err.message}`);
    res.status(500).json({ error: "failed to update zoom todo" });
  }
});

// --- SSE: live change notifications -----------------------------------------

const sseClients = new Set();

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: ready\ndata: {}\n\n");

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

function broadcastChanged() {
  for (const client of sseClients) {
    client.write("event: changed\ndata: {}\n\n");
  }
}

let debounceTimer = null;
function scheduleBroadcast() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    broadcastChanged();
  }, 150);
}

const watcher = chokidar.watch(scopeRoot, {
  ignoreInitial: true,
  ignorePermissionErrors: true,
});
watcher
  .on("add", scheduleBroadcast)
  .on("change", scheduleBroadcast)
  .on("unlink", scheduleBroadcast)
  .on("addDir", scheduleBroadcast)
  .on("unlinkDir", scheduleBroadcast)
  .on("error", (err) => console.warn(`watcher error: ${err.message}`));

app.listen(PORT, () => {
  console.log(`Second Brain server listening on http://localhost:${PORT}`);
  console.log(`Watching: ${scopeRoot}`);
  if (!fs.existsSync(scopeRoot)) {
    console.log(
      `Note: "${SCOPE_FOLDER}/" does not exist yet — serving empty state until it is created.`
    );
  }
});
