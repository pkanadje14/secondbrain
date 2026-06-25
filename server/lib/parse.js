import path from "node:path";
import matter from "gray-matter";
import { OWNER_NAME, normalizePersonList, normalizePersonName } from "./identity.js";

const PREVIEW_MAX = 160;

// --- small pure helpers -----------------------------------------------------

function filenameSlugTitle(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstH1(body) {
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*#\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

function firstParagraph(body) {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    return line;
  }
  return "";
}

function truncate(str, max = PREVIEW_MAX) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

function deriveInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic, stable color for people without a profile page.
function hashColor(name) {
  let hash = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

function asBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

// gray-matter's YAML loader turns unquoted `date: 2026-05-29` into a JS Date.
// The contract requires plain YYYY-MM-DD strings, and date equality in
// buildState depends on it. Normalize Date | string -> YYYY-MM-DD | null.
function normalizeDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeImportance(value) {
  if (value === "project" || value === "personal") return value;
  return null;
}

function normalizeTasks(value) {
  return asArray(value).map((task) => ({
    text: task?.text ?? "",
    done: asBool(task?.done, false),
  }));
}

// --- per-type normalizers ----------------------------------------------------

function normalizeNote(data, body, absPath) {
  const title =
    data.title ?? firstH1(body) ?? filenameSlugTitle(absPath);
  const preview = data.preview
    ? String(data.preview).trim()
    : truncate(firstParagraph(body));

  const note = {
    id: data.id,
    source: data.source ?? "obsidian",
    person: normalizePersonName(data.person),
    importance: normalizeImportance(data.importance),
    tags: asArray(data.tags),
    date: normalizeDate(data.date),
    pinned: asBool(data.pinned, false),
    done: asBool(data.done, false),
    archived: asBool(data.archived, false),
    read: asBool(data.read, false),
    starred: asBool(data.starred, false),
    title,
    preview,
    body,
  };
  if (data.channel !== undefined) note.channel = data.channel;
  if (data.permalink !== undefined) note.permalink = String(data.permalink);
  return note;
}

function normalizeDaily(data, body, absPath) {
  const title = data.title ?? firstH1(body) ?? filenameSlugTitle(absPath);
  const preview = data.preview
    ? String(data.preview).trim()
    : truncate(firstParagraph(body));

  const tags = asArray(data.tags);
  if (!tags.includes("daily")) tags.push("daily");

  return {
    id: data.id,
    kind: "daily",
    source: "obsidian",
    person: OWNER_NAME,
    importance: "personal",
    tags,
    date: normalizeDate(data.date),
    pinned: asBool(data.pinned, false),
    done: asBool(data.done, false),
    archived: asBool(data.archived, false),
    title,
    preview,
    body,
    tasks: normalizeTasks(data.tasks),
  };
}

function normalizeMeeting(data) {
  return {
    id: data.id,
    date: normalizeDate(data.date),
    title: data.title ?? "",
    start: data.start ?? null,
    end: data.end ?? null,
    platform: data.platform ?? null,
    status: data.status ?? "accepted",
    attendees: normalizePersonList(data.attendees),
    linkedNotes: asArray(data.linkedNotes),
    join: data.join ?? "#",
  };
}

function normalizeTask(data) {
  return {
    key: data.key,
    date: normalizeDate(data.date),
    title: data.title ?? "",
    status: data.status ?? null,
    priority: data.priority ?? null,
    board: data.board ?? null,
  };
}

function normalizeWiki(data, body, absPath) {
  const title = data.title ?? firstH1(body) ?? filenameSlugTitle(absPath);
  return {
    id: data.id,
    title,
    type: data.wiki_type ?? "concept",
    updated: normalizeDate(data.updated),
    sources: asArray(data.sources),
    links: asArray(data.links),
    body,
  };
}

// Weekly Hits/Misses/Goals update (manager-facing). Structured fields render
// the Update tab; `body` keeps the raw template for Obsidian readability.
function normalizeHmg(data, body) {
  return {
    id: data.id,
    week: data.week ?? "",
    friday: normalizeDate(data.friday),
    generated: normalizeDate(data.generated),
    impact: data.impact ? String(data.impact).trim() : "",
    hits: asArray(data.hits).map((x) => String(x)),
    misses: asArray(data.misses).map((x) => String(x)),
    goals: asArray(data.goals).map((x) => String(x)),
    body,
  };
}

// Zoom meeting artifact: transcript body + structured summary/to-dos. `todos`
// reuses the {text,done} task normalizer so the UI checkbox toggle is uniform.
function normalizeZoom(data, body, absPath) {
  const title = data.title ?? firstH1(body) ?? filenameSlugTitle(absPath);
  return {
    id: data.id,
    title,
    date: normalizeDate(data.date),
    start: data.start ?? null,
    duration: data.duration ?? null,
    participants: normalizePersonList(data.participants),
    recordingUrl: data.recordingUrl ?? null,
    summary: data.summary ? String(data.summary).trim() : "",
    todos: normalizeTasks(data.todos),
    transcript: body,
  };
}

function normalizePerson(data) {
  const name = normalizePersonName(data.name, "");
  const person = {
    name,
    initials: data.initials ?? deriveInitials(name),
    color: data.color ?? "#868291",
    role: data.role ?? "",
    hidden: asBool(data.hidden, false),
  };
  // Optional Slack-style profile fields. Only attach when present so derived
  // people (built from note authors) and minimal person files stay clean.
  const PROFILE_FIELDS = [
    "title", "handle", "tz", "desc",
    "prodId", "stageId",                                    // legacy single ids
    "prodFetchId", "prodPersonalId", "stageFetchId", "stagePersonalId",
  ];
  for (const field of PROFILE_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      person[field] = String(data[field]);
    }
  }
  return person;
}

const NORMALIZERS = {
  note: (data, body, absPath) => normalizeNote(data, body, absPath),
  daily: (data, body, absPath) => normalizeDaily(data, body, absPath),
  meeting: (data) => normalizeMeeting(data),
  task: (data) => normalizeTask(data),
  person: (data) => normalizePerson(data),
  wiki: (data, body, absPath) => normalizeWiki(data, body, absPath),
  hmg: (data, body) => normalizeHmg(data, body),
  zoom: (data, body, absPath) => normalizeZoom(data, body, absPath),
};

const LOG_LINE = /^## \[(\d{4}-\d{2}-\d{2})\]\s*(\w+)\s*\|\s*(.*)$/;

/**
 * Parse log.md into [{ date, kind, text }], newest first. Absent/empty -> [].
 */
export function parseWikiLog(rawContent) {
  if (!rawContent) return [];
  const entries = [];
  for (const line of rawContent.split("\n")) {
    const m = line.match(LOG_LINE);
    if (m) entries.push({ date: m[1], kind: m[2], text: m[3].trim() });
  }
  return entries.reverse();
}

/**
 * Slugify a free-text title: lowercase, non-alnum -> "-", trim "-", cap ~50.
 */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

// --- public API --------------------------------------------------------------

/**
 * Parse one markdown file into { sb_type, data } using its frontmatter.
 * Returns null when there is no recognized sb_type.
 */
export function parseFile(absPath, rawContent) {
  const parsed = matter(rawContent);
  const sb_type = parsed.data?.sb_type;
  if (!sb_type) return null;

  const normalize = NORMALIZERS[sb_type];
  if (!normalize) return null;

  const body = parsed.content.replace(/^\s+/, "");
  return { sb_type, data: normalize(parsed.data, body, absPath) };
}

/**
 * Assemble the /api/state payload from parsed files.
 */
export function buildState(files, systemToday, logRaw = "") {
  const notes = [];
  const dailies = [];
  const meetings = [];
  const tasks = [];
  const personItems = [];
  const wikiItems = [];
  const hmgItems = [];
  const zoomItems = [];

  for (const file of files) {
    switch (file.sb_type) {
      case "note":
        notes.push(file.data);
        break;
      case "daily":
        dailies.push(file.data);
        break;
      case "meeting":
        meetings.push(file.data);
        break;
      case "task":
        tasks.push(file.data);
        break;
      case "person":
        personItems.push(file.data);
        break;
      case "wiki":
        wikiItems.push(file.data);
        break;
      case "hmg":
        hmgItems.push(file.data);
        break;
      case "zoom":
        zoomItems.push(file.data);
        break;
      default:
        break;
    }
  }

  // "today" is the REAL current date — not the newest daily-note date. Using the
  // latest daily froze the app on the last day a daily note existed and mislabeled
  // that stale note as "Today".
  const today = systemToday;

  const daily = selectDaily(dailies, today);

  const todaysMeetings = meetings
    .filter((m) => m.date === today)
    .sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? "")));

  // Meetings within the Mon–Sun week containing `today`, for the calendar grid.
  const fmtDay = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const anchor = new Date(today + "T00:00:00");
  const weekStartDate = new Date(anchor);
  weekStartDate.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7)); // back to Monday
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  const weekStart = fmtDay(weekStartDate);
  const weekEnd = fmtDay(weekEndDate);
  const weekMeetings = meetings
    .filter((m) => m.date && m.date >= weekStart && m.date <= weekEnd)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start ?? "").localeCompare(String(b.start ?? "")));

  const todaysTasks = tasks.filter((t) => t.date === today);
  const agendaTasks = todaysTasks.length > 0 ? todaysTasks : tasks;

  const people = buildPeople(personItems, notes);
  const wiki = sortWiki(wikiItems);
  const wikiLog = parseWikiLog(logRaw);
  // Newest week first.
  const hmg = hmgItems
    .slice()
    .sort((a, b) => String(b.friday ?? "").localeCompare(String(a.friday ?? "")));
  // Newest meeting first.
  const zoom = zoomItems
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

  return {
    today,
    notes,
    daily,
    agenda: { date: today, meetings: todaysMeetings, weekMeetings, tasks: agendaTasks },
    people,
    wiki,
    wikiLog,
    hmg,
    zoom,
  };
}

// Overview pages first, then by `updated` desc (newest first).
function sortWiki(items) {
  return items.slice().sort((a, b) => {
    const aOverview = a.type === "overview" ? 0 : 1;
    const bOverview = b.type === "overview" ? 0 : 1;
    if (aOverview !== bOverview) return aOverview - bOverview;
    return String(b.updated ?? "").localeCompare(String(a.updated ?? ""));
  });
}

function selectDaily(dailies, today) {
  if (dailies.length === 0) return null;
  const match = dailies.find((d) => d.date === today);
  if (match) return match;
  return dailies
    .slice()
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
    .at(-1);
}

function buildPeople(personItems, notes) {
  const people = {};

  for (const person of personItems) {
    if (!person.name) continue;
    people[person.name] = person;
  }

  for (const note of notes) {
    const name = note.person;
    if (!name || name === OWNER_NAME || people[name]) continue;
    people[name] = {
      name,
      initials: deriveInitials(name),
      color: hashColor(name),
      role: "",
    };
  }

  return people;
}

export { deriveInitials, hashColor };
