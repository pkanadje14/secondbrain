// brain.jsx — persona, model grounding context, reply formatting, and local
// relevance matching so notes can surface inside the conversation.

import { getToday } from "./registry.js";
import { isOwnerName, normalizePersonName } from "./identity.js";

const ATLASSIAN_SOURCES = new Set(["atlassian", "jira", "confluence", "rfd"]);

const SOURCE_LABELS = {
  obsidian: "Obsidian",
  slack: "Slack",
  atlassian: "Atlassian",
  jira: "Jira",
  confluence: "Confluence",
  rfd: "RFD",
};

function sourceLabel(source) {
  const key = String(source || "obsidian").toLowerCase();
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function sourceContext(note) {
  const source = String(note.source || "obsidian").toLowerCase();
  if (source === "slack") {
    return `Slack ${note.channel || "unknown channel"} from ${note.person || "unknown person"}`;
  }
  if (ATLASSIAN_SOURCES.has(source)) {
    return `${sourceLabel(source)}${note.person ? ` from ${note.person}` : ""}`;
  }
  if (source === "obsidian") return `Obsidian, written by ${normalizePersonName(note.person)}`;
  return `${sourceLabel(source)}${note.person ? ` from ${note.person}` : ""}`;
}

function compactText(value, max = 520) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

function noteExcerpt(note) {
  const preview = compactText(note.preview, 180);
  const body = compactText(note.body, 420);
  if (!preview) return body;
  if (!body || body.toLowerCase().startsWith(preview.toLowerCase())) return preview;
  return compactText(`${preview} ${body}`, 560);
}

function noteSourceLine(note) {
  const imp = note.importance ? `[${note.importance === "project" ? "important for the project" : "owner note"}]` : "";
  const date = note.date || "unknown date";
  const tags = Array.isArray(note.tags) && note.tags.length ? note.tags.join(",") : "none";
  const link = note.permalink ? ` link:${note.permalink}` : "";
  const excerpt = noteExcerpt(note) || "No note text captured.";
  return `- id:${note.id} "${note.title}" (${sourceContext(note)}, ${date})${link} ${imp} tags:${tags} - ${excerpt}`;
}

function taskSourceLine(task) {
  const key = task.key ? `${task.key}: ` : "";
  const status = task.status ? ` status:${task.status}` : "";
  const priority = task.priority ? ` priority:${task.priority}` : "";
  const board = task.board ? ` board:${task.board}` : "";
  const date = task.date ? ` date:${task.date}` : "";
  return `- Jira ${key}${task.title || "Untitled task"}${status}${priority}${board}${date}`;
}

function sourceCounts(notes, tasks) {
  return notes.reduce((counts, note) => {
    const source = String(note.source || "obsidian").toLowerCase();
    if (source === "slack") counts.slack += 1;
    else if (ATLASSIAN_SOURCES.has(source)) counts.atlassian += 1;
    else if (source === "obsidian") counts.obsidian += 1;
    else counts.other += 1;
    return counts;
  }, { slack: 0, atlassian: tasks.length, obsidian: 0, other: 0 });
}

export function brainPersona(notes, people) {
  const live = notes.filter((n) => !n.archived);
  const tagCount = {};
  live.forEach((n) => n.tags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const focusTags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, 5);
  const collaborators = people.filter((p) => !isOwnerName(p.name));
  const project = live.filter((n) => n.importance === "project").length;
  const personal = live.filter((n) => n.importance === "personal").length;
  const today = new Date(getToday() + "T00:00:00");
  const week = live.filter((n) => (today - new Date(n.date + "T00:00:00")) / 86400000 < 7).length;
  return { total: live.length, focusTags, collaborators, project, personal, week };
}

/* A calm one-liner about the current workspace signal. */
export function personaEssence(notes, people) {
  const p = brainPersona(notes, people);
  const top = p.collaborators[0];
  const tag = p.focusTags[0];
  const bits = [];
  if (tag) bits.push(`deep in ${tag} work`);
  if (p.week) bits.push(`${p.week} new ${p.week === 1 ? "note" : "notes"} this week`);
  if (top) bits.push(`staying close to ${top.name.split(" ")[0]}`);
  return bits.length ? "Workspace is " + bits.join(" · ") + "." : "A quiet week. Ask anything.";
}

export function brainContext(notes, daily, options = {}) {
  const live = notes.filter((n) => !n.archived);
  const tasks = Array.isArray(options.tasks) ? options.tasks : [];
  const counts = sourceCounts(live, tasks);
  const lines = live.map(noteSourceLine).join("\n") || "- No notes are currently synced.";
  const taskLines = tasks.map(taskSourceLine).join("\n") || "- No Jira or Atlassian tasks are currently synced.";
  const dailyTasks = Array.isArray(daily?.tasks) ? daily.tasks : [];
  const dailyTxt = `Today's daily note (${daily?.date || "unknown date"}): tasks - ${dailyTasks.map((t) => (t.done ? "[done] " : "[todo] ") + t.text).join("; ") || "none"}.`;
  return `Act as the workspace Second Brain: the living memory of shared notes inside the Fetch notes app. Speak in a neutral workspace voice: warm, plainspoken, short sentences, calm and confident, no emoji, no exclamation marks. Answer ONLY from the notes below. If the answer is absent, say so in one sentence. Keep answers under 110 words. Use short "- " bullet lists when it helps. Refer to people by name.

HOME QUESTION RULES:
- The home questions ("What needs attention this week?", "Summarize project notes", "Who is collaborating most?", "What's important right now?") must be synthesized from this context by AI, not treated as canned answers.
- Prefer Slack plus Jira, Confluence, Atlassian, and RFD evidence first. Use Obsidian only to fill gaps.
- For collaboration questions, rank people by repeated Slack or Atlassian-family evidence and explain the concrete work tying them together.
- Include source labels in the answer, such as "Slack #channel - Title" or "Jira - KEY".
- If no Atlassian-family evidence is present, say that directly and continue from Slack and notes.
- Do not invent Slack, Jira, Confluence, Atlassian, RFD, people, dates, tickets, or links.

SOURCE COUNTS:
Slack ${counts.slack}; Atlassian-family ${counts.atlassian}; Obsidian ${counts.obsidian}; Other ${counts.other}.

WORKSPACE NOTES:
${lines}

ATLASSIAN/JIRA TASKS:
${taskLines}

${dailyTxt}`;
}

const STOP = new Set("the a an and or of to in on for with i it is are was were be this that these those at by from as about into note notes week day today what who how do does we our can could".split(" "));

export function relatedNotes(notes, query, reply, max = 3) {
  const text = (query + " " + reply).toLowerCase();
  const words = [...new Set(text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
  const scored = notes.filter((n) => !n.archived).map((n) => {
    const hay = (n.title + " " + n.preview + " " + n.tags.join(" ") + " " + n.person + " " + (n.channel || "") + " " + (n.body || "")).toLowerCase();
    let s = 0;
    words.forEach((w) => { if (hay.includes(w)) s += n.title.toLowerCase().includes(w) ? 2 : 1; });
    return { n, s };
  }).filter((x) => x.s > 1).sort((a, b) => b.s - a.s);
  return scored.slice(0, max).map((x) => x.n);
}

export function brainReply(text) {
  const blocks = [];
  let bullets = [];
  const flush = (k) => { if (bullets.length) { blocks.push(<ul className="rep-ul" key={"u" + k}>{bullets}</ul>); bullets = []; } };
  text.split("\n").forEach((ln, i) => {
    const s = ln.trim();
    if (!s) { flush(i); return; }
    if (/^[-•]\s+/.test(s)) bullets.push(<li key={i}>{s.replace(/^[-•]\s+/, "")}</li>);
    else { flush(i); blocks.push(<p key={i}>{s}</p>); }
  });
  flush("end");
  return blocks;
}
