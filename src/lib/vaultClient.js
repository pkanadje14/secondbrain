// vaultClient.js — talks to the vault backend and keeps the runtime registry current.

import { setRegistry } from "./registry.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export async function fetchState() {
  const res = await fetch(`${API_BASE}/api/state`);
  if (!res.ok) throw new Error(`vault backend ${res.status}`);
  const data = await res.json();
  // Feed the runtime singletons so personOf/fmtDate/the local brain see live data.
  setRegistry({ today: data.today, people: data.people, notes: data.notes, daily: data.daily });
  return data;
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof payload.error === "string" ? `: ${payload.error}` : "";
    throw new Error(`${path} ${res.status}${detail}`);
  }
  return payload;
}

// Writes — scoped to the vault's Second Brain/ surface by the backend. The
// chokidar watcher then pushes a `changed` event, so callers can rely on the SSE
// refresh; we also return the response for optimistic UI if wanted.
export const saveWikiPage = (page) => post("/api/wiki", page);
export const saveNoteToVault = (note) => post("/api/notes", note);
export const appendLog = (entry) => post("/api/log", entry);
// Flip a note's archived flag in the vault by its frontmatter id.
export const setNoteArchived = (id, archived) => post("/api/notes/archive", { id, archived });
// Flip a note's read flag in the vault by its frontmatter id (strikethrough in the UI).
export const setNoteRead = (id, read) => post("/api/notes/read", { id, read });
// Flip a note's starred flag in the vault by its frontmatter id.
export const setNoteStarred = (id, starred) => post("/api/notes/star", { id, starred });
// Hide/show a person in the People list by name (writes `hidden` to their profile).
export const setPersonHidden = (name, hidden) => post("/api/people/hide", { name, hidden });
// Toggle a daily note task by daily id + task index.
export const toggleDailyTask = (id, index, done) => post("/api/daily/task", { id, index, done });
// Toggle a Zoom meeting's to-do item (by meeting id + todo index) in the vault.
export const toggleZoomTodo = (id, index, done) => post("/api/zoom/todo", { id, index, done });

// Subscribe to live vault changes (file added/edited/removed under Second Brain/).
// Returns an unsubscribe function. The backend pushes an SSE `changed` event; the
// caller refetches state. Falls back silently if SSE is unavailable.
export function subscribe(onChange) {
  let es;
  try {
    es = new EventSource(`${API_BASE}/api/events`);
    es.addEventListener("changed", () => onChange());
    es.onerror = () => { /* browser auto-reconnects; nothing to do */ };
  } catch {
    return () => {};
  }
  return () => es && es.close();
}
