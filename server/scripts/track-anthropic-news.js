import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import matter from "gray-matter";
import { slugify } from "../lib/parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

loadEnv({ path: path.join(serverRoot, ".env") });

const NEWS_URL = process.env.ANTHROPIC_NEWS_URL || "https://www.anthropic.com/news";
const VAULT_PATH = process.env.VAULT_PATH;
const SCOPE_FOLDER = "Second Brain";
const PAGE_TITLE = "Anthropic News";
const PAGE_ID = "w-anthropic-news";

if (!VAULT_PATH) {
  console.error("FATAL: VAULT_PATH is not set in server/.env");
  process.exit(1);
}

const scopeRoot = path.join(VAULT_PATH, SCOPE_FOLDER);
const stateDir = path.join(scopeRoot, ".state");
const statePath = path.join(stateDir, "anthropic-news.json");
const wikiDir = path.join(scopeRoot, "wiki");
const HISTORY_LIMIT = 30;

function systemToday() {
  return new Date().toISOString().slice(0, 10);
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value) {
  return String(value ?? "").replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (raw, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    const named = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\"",
    };
    return named[lower] ?? raw;
  });
}

function cleanText(html) {
  return decodeHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, regex) {
  const match = html.match(regex);
  return match ? cleanText(match[1]) : "";
}

function absoluteAnthropicUrl(href) {
  return new URL(href, NEWS_URL).toString();
}

function parseNewsItems(html) {
  const byKey = new Map();
  const anchorRegex = /<a\s+[^>]*href="(\/news\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let featuredOrder = 0;
  let listOrder = 0;

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const content = match[2];
    const isListItem = match[0].includes("PublicationList");

    const title =
      firstMatch(content, /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
      firstMatch(content, /<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const date = firstMatch(content, /<time[^>]*>([\s\S]*?)<\/time>/i);
    const category =
      firstMatch(content, /<span[^>]*class="[^"]*\bcaption\b[^"]*\bbold\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
      firstMatch(content, /<span[^>]*class="[^"]*subject[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const summary = firstMatch(content, /<p[^>]*>([\s\S]*?)<\/p>/i);

    if (!title || !date) continue;
    const order = isListItem ? listOrder++ : 10_000 + featuredOrder++;
    const current = byKey.get(href);
    byKey.set(href, {
      ...current,
      key: href,
      url: absoluteAnthropicUrl(href),
      title,
      date,
      category,
      summary: current?.summary || summary,
      order: isListItem ? order : current?.order ?? order,
    });
  }

  return [...byKey.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...item }) => item);
}

async function readPreviousState() {
  try {
    return JSON.parse(await fsp.readFile(statePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function findExistingWikiPage(title) {
  try {
    const files = await fsp.readdir(wikiDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const absPath = path.join(wikiDir, file);
      try {
        const fm = matter(await fsp.readFile(absPath, "utf8"));
        if (fm.data?.sb_type === "wiki" && String(fm.data?.title ?? "").toLowerCase() === title.toLowerCase()) {
          return { absPath, fm };
        }
      } catch {
        // Skip unreadable wiki files; one bad page should not block this monitor.
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return null;
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatNewsRow(item) {
  return `| ${escapeTable(item.date)} | ${escapeTable(item.category || "-")} | [${escapeTable(item.title)}](${item.url}) |`;
}

function formatBullet(item) {
  const category = item.category ? ` ${item.category}` : "";
  const summary = item.summary ? ` — ${item.summary}` : "";
  return `- ${item.date}${category}: [${item.title}](${item.url})${summary}`;
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function buildDailySummaryText(added, changed, previousState) {
  if (!previousState) {
    return `Baseline created with ${plural(added.length, "entry", "entries")}`;
  }
  if (added.length === 0 && changed.length === 0) {
    return "No changes";
  }

  return [
    added.length ? plural(added.length, "new entry", "new entries") : null,
    changed.length ? plural(changed.length, "updated entry", "updated entries") : null,
  ].filter(Boolean).join(", ");
}

function buildDailyHistory(previousState, checkedAt, signatureChanged, items, added, changed) {
  const today = systemToday();
  const previousHistory = Array.isArray(previousState?.history) ? previousState.history : [];
  const entry = {
    date: today,
    checkedAt,
    changed: signatureChanged,
    added,
    updated: changed,
    total: items.length,
    summary: buildDailySummaryText(added, changed, previousState),
  };

  return [
    entry,
    ...previousHistory.filter((item) => item?.date !== today),
  ].slice(0, HISTORY_LIMIT);
}

function formatDailyHistoryEntry(entry) {
  const added = Array.isArray(entry?.added) ? entry.added : [];
  const updated = Array.isArray(entry?.updated) ? entry.updated : [];
  const lines = [
    `- ${entry.date}: ${entry.summary || "No changes"} (${entry.total ?? 0} tracked)`,
  ];

  if (added.length === 0 && updated.length === 0) {
    lines.push("  - No changes");
    return lines.join("\n");
  }

  added.forEach((item) => lines.push(`  - New: ${formatBullet(item).slice(2)}`));
  updated.forEach((item) => lines.push(`  - Updated: ${formatBullet(item).slice(2)}`));
  return lines.join("\n");
}

function formatDailyHistory(history) {
  if (!history.length) return ["- No daily checks recorded yet."];
  return history.slice(0, 14).map(formatDailyHistoryEntry);
}

function buildNotificationBlock(added, changed, previousState) {
  const total = added.length + changed.length;
  if (!previousState) {
    return [
      "## Notification",
      "**New notification:** Anthropic News tracking is now active.",
      "",
      "Daily check: 7:00 AM local time.",
    ];
  }
  if (total === 0) {
    return [
      "## Notification",
      "No new Anthropic News notifications.",
      "",
      "Daily check: 7:00 AM local time.",
    ];
  }
  return [
    "## Notification",
    `**New notification:** ${total} Anthropic News item${total === 1 ? "" : "s"} changed since the last check.`,
    "",
    "Daily check: 7:00 AM local time.",
  ];
}

function buildWikiBody(items, added, changed, previousState, history) {
  const today = systemToday();
  const intro = previousState
    ? `Tracked change set for [Anthropic News](${NEWS_URL}).`
    : `Baseline created for [Anthropic News](${NEWS_URL}).`;
  const addedBlock = added.length
    ? added.map(formatBullet).join("\n")
    : previousState
      ? "- No new entries detected."
      : "- No new entries; baseline captured.";
  const changedBlock = changed.length
    ? ["", "## Changed Existing Entries", changed.map(formatBullet).join("\n")]
    : [];

  return [
    intro,
    "",
    `- Last checked: ${today}`,
    `- Tracked entries: ${items.length}`,
    `- Latest signature: \`${hash(JSON.stringify(items)).slice(0, 12)}\``,
    "",
    ...buildNotificationBlock(added, changed, previousState),
    "",
    "## Daily Summary",
    ...formatDailyHistory(history),
    "",
    "## New Since Last Check",
    addedBlock,
    ...changedBlock,
    "",
    "## Current News List",
    "| Date | Category | Title |",
    "|---|---|---|",
    ...items.map(formatNewsRow),
    "",
  ].join("\n");
}

async function writeWikiPage(items, added, changed, previousState, history) {
  const slug = slugify(PAGE_TITLE);
  const existing = await findExistingWikiPage(PAGE_TITLE);
  const target = existing?.absPath ?? path.join(wikiDir, `${slug}.md`);
  const data = {
    sb_type: "wiki",
    id: existing?.fm?.data?.id ?? PAGE_ID,
    wiki_type: existing?.fm?.data?.wiki_type ?? "entity",
    title: PAGE_TITLE,
    updated: systemToday(),
    sources: existing?.fm?.data?.sources ?? [],
    links: existing?.fm?.data?.links ?? ["Anthropic"],
  };

  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, matter.stringify(buildWikiBody(items, added, changed, previousState, history), data), "utf8");
}

async function appendLog(added, changed, previousState) {
  const logPath = path.join(scopeRoot, "log.md");
  if (!fs.existsSync(logPath)) {
    await fsp.mkdir(scopeRoot, { recursive: true });
    await fsp.writeFile(logPath, "# Log — Second Brain surface\n\nAppend-only. One line per operation.\n", "utf8");
  }
  const kind = "monitor";
  const action = previousState
    ? `${added.length} new, ${changed.length} changed Anthropic news item${added.length + changed.length === 1 ? "" : "s"}`
    : "Anthropic News baseline created";
  await fsp.appendFile(logPath, `\n## [${systemToday()}] ${kind} | ${action} → [[${PAGE_TITLE}]]\n`, "utf8");
}

async function fetchNewsHtml() {
  const response = await fetch(NEWS_URL, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "SecondBrainAnthropicNewsMonitor/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${NEWS_URL} failed with ${response.status}`);
  }

  return response.text();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const html = await fetchNewsHtml();
  const items = parseNewsItems(html);
  if (items.length === 0) {
    throw new Error("No Anthropic news entries found in page HTML");
  }

  const signature = hash(JSON.stringify(items));
  const previousState = await readPreviousState();
  const previousKeys = new Set((previousState?.items ?? []).map((item) => item.key));
  const previousByKey = new Map((previousState?.items ?? []).map((item) => [item.key, item]));
  const checkedAt = new Date().toISOString();
  const signatureChanged = previousState?.signature !== signature;
  const added = previousState ? items.filter((item) => !previousKeys.has(item.key)) : items;
  const changed = previousState
    ? items.filter((item) => {
        const previous = previousByKey.get(item.key);
        return previous && JSON.stringify(previous) !== JSON.stringify(item);
      })
    : [];
  const history = buildDailyHistory(previousState, checkedAt, signatureChanged, items, added, changed);

  if (dryRun) {
    console.log(JSON.stringify({ changed: signatureChanged, added: added.length, updated: changed.length, total: items.length, dailySummary: history[0], items }, null, 2));
    return;
  }

  await fsp.mkdir(stateDir, { recursive: true });
  await writeWikiPage(items, added, changed, previousState, history);
  if (signatureChanged) {
    await appendLog(added, changed, previousState);
  }
  await fsp.writeFile(statePath, JSON.stringify({ checkedAt, signature, items, history }, null, 2), "utf8");
  const changedLabel = !signatureChanged ? "daily notification refreshed" : previousState ? "updated" : "baseline created";
  console.log(`Anthropic News ${changedLabel}: ${added.length} new, ${changed.length} changed, ${items.length} total.`);
}

main().catch((err) => {
  console.error(`track-anthropic-news failed: ${err.message}`);
  process.exit(1);
});
