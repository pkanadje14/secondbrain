// ai.js — the conversational engine behind the workspace brain.
//
// The design prototype called a host-injected `window.claude.complete`. A real
// app needs a real source. This module is a pluggable client with three tiers,
// tried in order. Home chat can opt out of the local tier when answers must come
// from a model:
//
//   1. VITE_AI_ENDPOINT or /api/ai — POST { messages } to the backend model path.
//   2. window.claude.complete — present when running inside Claude's design host.
//   3. Local grounded brain — a zero-config heuristic that answers strictly from
//      workspace notes. Kept only as an explicit fallback.
//
// `complete({ messages })` resolves to a plain string, matching the prototype.

import { getNotes, getDaily } from "./registry.js";
import { relatedNotes } from "./brain.jsx";
import { isOwnerName } from "./identity.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";
const ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || `${API_BASE}/api/ai`;

export async function complete({ messages, allowLocalFallback = true }) {
  if (ENDPOINT) {
    try {
      const reply = await completeFromEndpoint(messages);
      if (reply) return reply;
      if (!allowLocalFallback) throw new Error("AI endpoint returned an empty response");
    } catch (err) {
      if (!allowLocalFallback) throw err;
    }
  }

  if (typeof window !== "undefined" && window.claude?.complete) {
    return window.claude.complete({ messages });
  }

  if (!allowLocalFallback) {
    throw new Error("AI endpoint is unavailable");
  }

  return localBrain(messages);
}

async function completeFromEndpoint(messages) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`AI endpoint ${res.status}`);
  const data = await res.json().catch(() => null);
  if (typeof data === "string") return data.trim();
  return String((data && (data.text ?? data.content ?? data.reply)) || "").trim();
}

/* ------------------------------------------------------------------ */
/* Local grounded brain — answers only from the notes, in Fetch voice. */
/* ------------------------------------------------------------------ */

function lastUserQuestion(messages) {
  // The convo is [context, "Got it.", ...turns]. The real question is the last
  // user turn that isn't the long grounding context (which we send first).
  const users = messages.filter((m) => m.role === "user");
  return (users[users.length - 1]?.content || "").trim();
}

const FIRST = (name) => name.split(" ")[0];

function delay(fn) {
  // simulate a touch of latency so the typing indicator reads as real
  return new Promise((resolve) => setTimeout(() => resolve(fn()), 480 + Math.random() * 420));
}

function localBrain(messages) {
  const q = lastUserQuestion(messages);

  // The Wiki tab's Ingest/Lint ask for a structured JSON object. The local brain
  // has no real LLM, so produce a grounded heuristic proposal/report rather than
  // prose (which would fail JSON parsing). A real model via VITE_AI_ENDPOINT or
  // the Claude host gives far better synthesis; this keeps the flow working offline.
  if (isIngestPrompt(q)) return delay(() => JSON.stringify(buildIngestProposal(q)));
  if (isLintPrompt(q)) return delay(() => JSON.stringify(buildLintReport(q)));

  const ql = q.toLowerCase();
  const live = getNotes().filter((n) => !n.archived);
  return delay(() => answerFor(q, ql, live));
}

/* ---- heuristic Wiki Ingest / Lint (offline fallback) ------------------- */

function isIngestPrompt(s) { return s.includes("NEW SOURCE —") && s.includes('"updates"'); }
function isLintPrompt(s) { return s.includes("WIKI PAGES:") && s.includes('"orphans"'); }

const WSTOP = new Set("the a an and or of to in on for with i it is are was were be this that at by from as about into note notes had have has met meet meeting with".split(" "));
function tok(s) { return [...new Set((s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !WSTOP.has(w)))]; }
function overlap(a, b) { const set = new Set(b); return a.filter((w) => set.has(w)).length; }
function firstSentence(s) { const t = (s || "").trim().replace(/\s+/g, " "); const m = t.match(/^.{0,160}?[.!?](\s|$)/); return (m ? m[0] : t.slice(0, 160)).trim(); }

// Parse the "### Title (type, updated …)\nbody" blocks embedded in the prompt.
function parseWikiBlocks(s) {
  const idx = s.indexOf("### ");
  if (idx < 0) return [];
  const region = s.slice(idx).split("\nNEW SOURCE —")[0];
  return region.split(/\n### /).map((c, i) => (i === 0 ? c.replace(/^### /, "") : c)).map((chunk) => {
    const nl = chunk.indexOf("\n");
    const head = nl >= 0 ? chunk.slice(0, nl) : chunk;
    const body = nl >= 0 ? chunk.slice(nl + 1) : "";
    const hm = head.match(/^(.+?) \((overview|concept|entity)/);
    return { title: hm ? hm[1] : head.trim(), type: hm ? hm[2] : "concept", body };
  }).filter((b) => b.title);
}

function buildIngestProposal(prompt) {
  const blocks = parseWikiBlocks(prompt);
  const sm = prompt.match(/NEW SOURCE — "([^"]*)":\s*([\s\S]*)$/);
  const srcTitle = (sm && sm[1]) || "Source";
  const srcText = ((sm && sm[2]) || "").trim();
  const words = tok(srcTitle + " " + srcText);

  // Score existing pages by word overlap with their title; strong matches → updates.
  const scored = blocks
    .map((b) => ({ b, score: overlap(words, tok(b.title)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const updates = scored.slice(0, 2).map((x) => ({ title: x.b.title, change: firstSentence(srcText) || ("New mention from " + srcTitle) }));

  let creates = [];
  if (!updates.length) {
    const cleaned = srcTitle.replace(/^\s*meeting with\s+/i, "").trim();
    const looksPerson = /^meeting with /i.test(srcTitle) || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(cleaned);
    creates = [{
      title: cleaned || "Untitled note",
      type: looksPerson ? "entity" : "concept",
      body: (firstSentence(srcText) ? firstSentence(srcText) + "\n\n" : "") + (srcText.slice(0, 280) || "Captured from a source."),
    }];
  }

  return {
    summary: firstSentence(srcText) || srcTitle,
    updates,
    creates,
    contradictions: [],
    links: updates.map((u) => u.title),
  };
}

function buildLintReport(prompt) {
  const blocks = parseWikiBlocks(prompt);
  const titles = blocks.map((b) => b.title);
  const lc = (s) => s.toLowerCase();

  // orphan: a page whose title is never linked from another page's body.
  const orphans = titles.filter((t) => !blocks.some((b) => lc(b.title) !== lc(t) && lc(b.body).includes("[[" + lc(t))));

  // missing: a [[link]] used in some body that doesn't resolve to a page title.
  const linked = new Set();
  blocks.forEach((b) => { const re = /\[\[([^\]]+)\]\]/g; let m; while ((m = re.exec(b.body))) linked.add(m[1].split("|")[0].trim()); });
  const missing = [...linked].filter((l) => !titles.some((t) => lc(t) === lc(l)));

  const questions = [];
  if (titles.length >= 2) questions.push(`How are "${titles[0]}" and "${titles[1]}" connected?`);
  if (orphans.length) questions.push(`Should "${orphans[0]}" link to anything?`);

  return {
    contradictions: [],
    stale: [],
    orphans: orphans.slice(0, 3),
    missing: missing.slice(0, 3),
    questions: questions.slice(0, 3),
  };
}

function answerFor(q, ql, live) {
  // person intent — "what did Maya say", "how is Devon connected"
  const person = findPerson(ql, live);
  if (person) return personAnswer(person, live);

  // focus / week / day intent
  if (/(focus|this week|priorit|important|what should i|what needs|day|today|wait)/.test(ql)) {
    return focusAnswer(live);
  }

  // project vs personal split
  if (/\bproject\b/.test(ql)) return scopeAnswer(live, "project");
  if (/(owner|personal|myself)/.test(ql)) return scopeAnswer(live, "personal");

  // generic — ground in the most relevant notes
  const rel = relatedNotes(live, q, "");
  if (!rel.length) {
    return "No matching workspace notes found. Try asking about project work, a person, or current focus.";
  }
  const lead = rel[0];
  const lines = ["Workspace notes say this."];
  rel.forEach((n) => lines.push(`- ${n.title} — ${trim(n.preview)}`));
  lines.push(`Open ${quoteFirst(lead)} if you want the full picture.`);
  return lines.join("\n");
}

function findPerson(ql, live) {
  const names = [...new Set(live.map((n) => n.person))].filter((n) => !isOwnerName(n));
  return names.find((name) => ql.includes(FIRST(name).toLowerCase()) || ql.includes(name.toLowerCase()));
}

function personAnswer(name, live) {
  const theirs = live.filter((n) => n.person === name);
  if (!theirs.length) return `No current workspace notes from ${FIRST(name)}.`;
  const recent = [...theirs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lines = [`${FIRST(name)} shows up across ${theirs.length} ${theirs.length === 1 ? "note" : "notes"}.`];
  recent.slice(0, 3).forEach((n) => lines.push(`- ${n.title} — ${trim(n.preview)}`));
  return lines.join("\n");
}

function focusAnswer(live) {
  const projects = live.filter((n) => n.importance === "project");
  const daily = getDaily();
  const openTasks = (daily?.tasks || []).filter((t) => !t.done).map((t) => t.text);
  const lines = ["This is where attention belongs."];
  projects.slice(0, 3).forEach((n) => lines.push(`- ${n.title} — ${trim(n.preview)}`));
  if (openTasks.length) {
    lines.push("");
    lines.push("From today's note, still open:");
    openTasks.forEach((t) => lines.push(`- ${t}`));
  }
  lines.push("");
  lines.push("Owner-note threads can wait until project work lands.");
  return lines.join("\n");
}

function scopeAnswer(live, scope) {
  const set = live.filter((n) => n.importance === scope);
  if (!set.length) return scope === "project" ? "No project-flagged notes yet." : "No owner-flagged notes yet.";
  const label = scope === "project" ? "matters for the project" : "is marked for Owner";
  const lines = [`This is what ${label}.`];
  set.forEach((n) => lines.push(`- ${n.title} — ${trim(n.preview)}`));
  return lines.join("\n");
}

function trim(s, n = 90) {
  const t = s.replace(/[“”]/g, "").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}
function quoteFirst(note) {
  return `"${note.title}"`;
}
