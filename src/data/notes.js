// notes.js — mock notes for the second brain. Two sources: Obsidian
// vault + Slack. Ported from the design
// prototype's data.jsx; the window-global export became named ES exports.

export const TODAY = "2026-05-29";

export const DAILY_NOTE = {
  id: "daily-2026-05-29",
  source: "obsidian",
  kind: "daily",
  title: "Friday, May 29",
  preview: "3 tasks · 2 meetings · captured 4 ideas",
  tags: ["daily"],
  date: TODAY,
  time: "08:12",
  pinned: true,
  done: false,
  archived: false,
  tasks: [
    { text: "Review eReceipt parser PR", done: true },
    { text: "Draft points-expiry experiment brief", done: false },
    { text: "1:1 prep — Maya", done: false },
  ],
  body:
    "## Focus\nShip the receipt-scan latency fix before the long weekend.\n\n## Notes\n- Standup: backend caught the duplicate-credit edge case. Good.\n- Idea: surface “points pending” state on the home tile so users stop refreshing.\n- Remember to thank the data team for the funnel pull.\n\n## Links\n- [[Points expiry experiment]]\n- [[Receipt scan latency]]",
};

export const NOTES = [
  {
    id: "n-points-expiry",
    source: "obsidian",
    title: "Points expiry experiment",
    preview:
      "Hypothesis: a 7-day warning before points expire lifts reactivation. Need to size the dormant cohort first.",
    body:
      "## Hypothesis\nA gentle 7-day warning before points expire will lift reactivation among dormant users without nagging active ones.\n\n## Open questions\n- How big is the 60–90 day dormant cohort?\n- Email, push, or in-app banner first?\n- Guardrail: unsubscribe rate.\n\n## Next\n- [ ] Pull dormant cohort size (data team)\n- [ ] Draft 3 message variants\n- [ ] Sync with lifecycle PM",
    tags: ["experiment", "lifecycle", "points"],
    date: "2026-05-28",
    pinned: true,
    done: false,
    archived: false,
  },
  {
    id: "n-latency",
    source: "obsidian",
    title: "Receipt scan latency",
    preview:
      "Median scan-to-points dropped from 9.2s to 3.4s after the cache change. p95 still ugly on Android.",
    body:
      "Median scan-to-points dropped from 9.2s → 3.4s after the OCR result cache landed.\n\np95 is still ugly on older Android devices (12s+). Suspect the image upload step, not OCR.\n\n## To verify\n- Break down timing by device tier\n- Is the retry loop double-uploading?",
    tags: ["eng", "performance"],
    date: "2026-05-27",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "s-design-sync",
    source: "slack",
    channel: "#design-sync",
    author: "Maya Chen",
    title: "Maya: home tile redesign feedback",
    preview:
      "“Love the points-pending state. Can we make the receipt count less shouty? Feels like it competes with the CTA.”",
    body:
      "Saved from #design-sync — Maya Chen, 2:41pm\n\n“Love the points-pending state on the home tile. Two things:\n1. The receipt count feels too shouty — it competes with the primary CTA.\n2. Can we try the pending shimmer at 60% opacity?\n\nWill drop Figma frames after standup.”\n\n## Owner note\nAgree on #1. The count can drop to secondary text. Keep shimmer subtle.",
    tags: ["design", "home"],
    date: "2026-05-28",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "s-data-funnel",
    source: "slack",
    channel: "#data-requests",
    author: "Priya N.",
    title: "Priya: scan funnel pull",
    preview:
      "Funnel is camera-open → capture → submit → credited. Biggest drop is capture → submit (28%).",
    body:
      "Saved from #data-requests — Priya N.\n\nFunnel for last 30d:\n- camera open → capture: 91%\n- capture → submit: 72%  ← biggest drop\n- submit → credited: 96%\n\nThe capture → submit drop is where to dig. Blurry-image retries may be scaring people off.",
    tags: ["data", "funnel"],
    date: "2026-05-26",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "n-1on1-maya",
    source: "obsidian",
    title: "1:1 — Maya",
    preview:
      "Talking points: roadmap for Q3, design-eng handoff friction, her interest in leading the lifecycle work.",
    body:
      "## Talking points\n- Q3 roadmap — what's firm vs aspirational\n- Design → eng handoff friction (specs landing late)\n- She's keen to lead lifecycle work — support this\n\n## Follow-ups\n- [ ] Share the experiment brief template\n- [ ] Loop her into the data sync",
    tags: ["1on1", "management"],
    date: "2026-05-25",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "n-snack-idea",
    source: "obsidian",
    title: "Idea: streak rewards for daily scans",
    preview:
      "What if scanning N days in a row unlocks a bonus multiplier? Risk: incentivizes junk receipts.",
    body:
      "What if scanning N days in a row unlocks a bonus multiplier?\n\n**Upside:** habit formation, more receipts.\n**Risk:** incentivizes junk / fake receipts. Need fraud guardrails.\n\nPark this until the latency work ships.",
    tags: ["idea", "growth"],
    date: "2026-05-24",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "s-oncall",
    source: "slack",
    channel: "#eng-oncall",
    author: "Devon R.",
    title: "Devon: duplicate-credit incident notes",
    preview:
      "Root cause was a retry that didn't check idempotency key. Patched. Backfill for affected users tomorrow.",
    body:
      "Saved from #eng-oncall — Devon R.\n\nIncident #4471 — duplicate points credited.\nRoot cause: receipt-submit retry path skipped the idempotency key check.\nFix: enforce key at the service boundary. Merged.\nBackfill: correcting ~1,200 affected accounts tomorrow AM.",
    tags: ["eng", "incident"],
    date: "2026-05-23",
    pinned: false,
    done: true,
    archived: false,
  },
  {
    id: "n-reading",
    source: "obsidian",
    title: "Reading: habit loops & rewards",
    preview:
      "Cue → routine → reward. The variable-ratio reward is the sticky part. Notes for the streak idea.",
    body:
      "Cue → routine → reward.\n\nThe **variable-ratio** reward schedule is what makes things sticky (slot machines, social feeds).\n\nFor Fetch: the points amount already varies by receipt — we may already have this. Don't over-engineer.",
    tags: ["reading", "idea"],
    date: "2026-05-22",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "s-brand",
    source: "slack",
    channel: "#brand",
    author: "Sam K.",
    title: "Sam: voice reminder",
    preview:
      "“Reminder: transactional copy stays calm — no exclamation marks. Save the excitement for the win moments.”",
    body:
      "Saved from #brand — Sam K.\n\n“Reminder for the new screens: transactional copy stays calm, no exclamation marks. '+42 points. Nice haul.' is a win moment — that can have energy. 'Receipt submitted.' is not — keep it flat.”",
    tags: ["brand", "copy"],
    date: "2026-05-21",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "n-q3",
    source: "obsidian",
    title: "Q3 roadmap draft",
    preview:
      "Three bets: scan reliability, lifecycle reactivation, and a lightweight social proof on the home tile.",
    body:
      "## Three bets\n1. **Scan reliability** — finish latency + the capture→submit drop.\n2. **Lifecycle reactivation** — points-expiry experiment, dormant cohort.\n3. **Social proof** — lightweight “friends earned this week” on home (stretch).\n\nKeep it to two committed, one stretch.",
    tags: ["roadmap", "planning"],
    date: "2026-05-20",
    pinned: false,
    done: false,
    archived: false,
  },
  {
    id: "n-archive-old",
    source: "obsidian",
    title: "Old onboarding teardown",
    preview:
      "Superseded by the new 3-step flow. Keeping for reference.",
    body:
      "Teardown of the previous 5-step onboarding. Superseded by the new 3-step flow that shipped in April. Archived for reference.",
    tags: ["onboarding"],
    date: "2026-04-30",
    pinned: false,
    done: false,
    archived: true,
  },
  {
    id: "s-archive-standup",
    source: "slack",
    channel: "#team-standup",
    author: "Owner",
    title: "Standup notes — week of May 11",
    preview: "Old standup capture. Archived.",
    body:
      "Saved from #team-standup — week of May 11.\nShipped the cache change to staging. Blocked on data pull. Resolved by EOW.",
    tags: ["standup"],
    date: "2026-05-15",
    pinned: false,
    done: false,
    archived: true,
  },
];

/* ---- people (senders) -------------------------------------------------- */
export const PEOPLE = {
  "Owner":     { name: "Owner",     initials: "O",  color: "#5B566C", role: "Owner" },
  "Maya Chen": { name: "Maya Chen", initials: "MC", color: "#FF57AC", role: "Design" },
  "Priya N.":  { name: "Priya N.",  initials: "PN", color: "#00A9A0", role: "Data" },
  "Devon R.":  { name: "Devon R.",  initials: "DR", color: "#2576E9", role: "Eng" },
  "Sam K.":    { name: "Sam K.",    initials: "SK", color: "#FFA900", role: "Brand" },
};

/* ---- importance: 'project' (matters for the work) | 'personal' (owner note) - */
const IMPORTANCE = {
  "n-points-expiry": "project",
  "n-latency": "project",
  "s-design-sync": "project",
  "s-data-funnel": "project",
  "s-oncall": "project",
  "s-brand": "project",
  "n-q3": "project",
  "n-1on1-maya": "personal",
  "n-snack-idea": "personal",
  "n-reading": "personal",
};

NOTES.forEach((n) => {
  n.person = n.source === "slack" ? n.author : "Owner";
  n.importance = IMPORTANCE[n.id] || null;
});
DAILY_NOTE.person = "Owner";
DAILY_NOTE.importance = "personal";
