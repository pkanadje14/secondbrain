// wiki.js — wiki type metadata + the context/prompt builders for Ingest + Lint.
//
// The wiki itself is now PERSISTENT: pages live in the vault at Second Brain/wiki/,
// the backend serves them via /api/state.wiki, and Ingest/Lint write real markdown
// back through the backend (see App.applyIngestToVault / vaultClient). WIKI_SEED /
// WIKI_LOG_SEED below are legacy offline fixtures, no longer used by the running app.
//
// Pages are markdown with [[wiki links]]; `sources` point at note ids.

export const WIKI_SEED = [
  {
    id: "overview",
    title: "Overview",
    type: "overview",
    updated: "2026-05-28",
    sources: ["n-q3", "n-points-expiry", "n-latency"],
    links: ["Receipt scan reliability", "Lifecycle reactivation", "Q3 roadmap"],
    body:
      "The through-line right now is **make the core loop trustworthy, then bring dormant users back**.\n\n## Where things stand\n- [[Receipt scan reliability]] is the foundation — latency is way down, but the capture→submit drop and Android p95 are open.\n- [[Lifecycle reactivation]] is the next bet, anchored by the points-expiry experiment.\n- [[Q3 roadmap]] commits to two of these and keeps social proof as a stretch.\n\n## Open tensions\n- Streak rewards could boost habit but risk junk receipts — parked until reliability ships.\n- Brand wants calm transactional copy; growth wants more surfacing on the home tile.",
  },
  {
    id: "receipt-scan",
    title: "Receipt scan reliability",
    type: "concept",
    updated: "2026-05-27",
    sources: ["n-latency", "s-data-funnel", "s-oncall"],
    links: ["Engineering", "Lifecycle reactivation"],
    body:
      "The reliability of scan → points credited, end to end.\n\n## What we know\n- Median scan-to-points dropped **9.2s → 3.4s** after the OCR result cache landed.\n- p95 is still poor on older Android (12s+) — suspected image-upload step, not OCR.\n- Funnel: the biggest drop is **capture → submit (72%)** — blurry-image retries may scare people off.\n\n## Resolved\n- Duplicate-credit incident traced to a retry skipping the idempotency key; fix merged, backfill underway.\n\n## Sources\nFrom Devon and Priya's threads plus the owner latency note.",
  },
  {
    id: "lifecycle",
    title: "Lifecycle reactivation",
    type: "concept",
    updated: "2026-05-28",
    sources: ["n-points-expiry", "n-reading"],
    links: ["Points & rewards", "Maya Chen"],
    body:
      "Bringing dormant users back without nagging the active ones.\n\n## Working hypothesis\nA gentle **7-day warning before points expire** lifts reactivation among 60–90 day dormant users.\n\n## Open questions\n- How big is the dormant cohort? (data pull requested)\n- Email, push, or in-app banner first?\n- Guardrail: unsubscribe rate.\n\n## Related thinking\nVariable-ratio rewards are the sticky part of habit loops — but points already vary by receipt, so don't over-engineer.",
  },
  {
    id: "points",
    title: "Points & rewards",
    type: "concept",
    updated: "2026-05-24",
    sources: ["n-snack-idea", "n-reading", "s-brand"],
    links: ["Lifecycle reactivation"],
    body:
      "How points are earned, framed, and felt.\n\n## Ideas in play\n- **Streak rewards**: scanning N days in a row unlocks a multiplier. Upside: habit. Risk: junk/fake receipts — needs fraud guardrails. Parked.\n\n## Voice\nTransactional copy stays calm — no exclamation marks. Save energy for genuine win moments (\"+42 points. Nice haul.\").",
  },
  {
    id: "maya",
    title: "Maya Chen",
    type: "entity",
    updated: "2026-05-28",
    sources: ["s-design-sync", "n-1on1-maya"],
    links: ["Lifecycle reactivation"],
    body:
      "Design partner. Wants to lead the lifecycle work.\n\n## Recent\n- On the home tile: likes the points-pending state; flagged the receipt count as too shouty vs the CTA; wants the pending shimmer softer.\n- 1:1 themes: Q3 clarity, design→eng handoff friction (specs landing late), and her interest in owning lifecycle.\n\n## Follow-ups\n- [ ] Share the experiment brief template\n- [ ] Loop her into the data sync",
  },
  {
    id: "q3",
    title: "Q3 roadmap",
    type: "entity",
    updated: "2026-05-20",
    sources: ["n-q3"],
    links: ["Receipt scan reliability", "Lifecycle reactivation"],
    body:
      "## Three bets\n1. **Scan reliability** — finish latency + the capture→submit drop.\n2. **Lifecycle reactivation** — points-expiry experiment, dormant cohort.\n3. **Social proof** — lightweight \"friends earned this week\" on home (stretch).\n\nCommit to two, keep one as stretch.",
  },
];

export const WIKI_LOG_SEED = [
  { date: "2026-05-28", kind: "ingest", text: "Maya: home tile redesign feedback → updated [[Maya Chen]], [[Receipt scan reliability]]" },
  { date: "2026-05-28", kind: "ingest", text: "Points expiry experiment → created [[Lifecycle reactivation]], updated [[Overview]]" },
  { date: "2026-05-27", kind: "ingest", text: "Receipt scan latency → updated [[Receipt scan reliability]]" },
  { date: "2026-05-26", kind: "lint", text: "Health check — 1 contradiction, 2 missing pages flagged" },
];

export const WIKI_TYPE = {
  overview: { label: "Overview", color: "var(--accent)", icon: "sparkle" },
  concept: { label: "Concept", color: "var(--fetch-orange-50)", icon: "tag" },
  entity: { label: "Entity", color: "var(--fetch-teal-50)", icon: "vault" },
};

/* compact context of the whole wiki for prompts */
export function wikiContext(pages) {
  return pages.map((p) => `### ${p.title} (${p.type}, updated ${p.updated})\n${p.body}`).join("\n\n");
}

/* ---- Ingest: ask the model how to integrate a source into the wiki ---- */
export function ingestPrompt(pages, sourceTitle, sourceText) {
  return `Maintain a shared workspace knowledge wiki. Below is the CURRENT WIKI, then a NEW SOURCE to integrate. Decide how the source changes the wiki: which existing pages to UPDATE, which new pages to CREATE, and any CONTRADICTIONS with existing claims.

Respond with ONLY a JSON object, no prose, in this exact shape:
{
  "summary": "one or two sentence takeaway of the source",
  "updates": [ { "title": "existing page title", "change": "one line describing what you'd add/revise" } ],
  "creates": [ { "title": "new page title", "type": "concept|entity", "body": "a short markdown body (2-4 lines, may use ## and - and [[links]])" } ],
  "contradictions": [ "one line each, or empty array" ],
  "links": [ "page titles this source connects" ]
}

CURRENT WIKI:
${wikiContext(pages)}

NEW SOURCE — "${sourceTitle}":
${sourceText}`;
}

export function lintPrompt(pages) {
  return `Audit a shared workspace knowledge wiki for health. Review the pages and report issues. Respond with ONLY a JSON object, no prose:
{
  "contradictions": [ "page A says X but page B says Y" ],
  "stale": [ "claim that a newer source likely supersedes" ],
  "orphans": [ "page titles with no inbound links" ],
  "missing": [ "concept mentioned but lacking its own page" ],
  "questions": [ "good question to investigate next" ]
}
Keep each array to at most 3 of the most useful items. Base everything only on the pages below.

WIKI PAGES:
${wikiContext(pages)}`;
}

/* tolerant JSON extraction from a model reply */
export function parseJSONReply(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}
