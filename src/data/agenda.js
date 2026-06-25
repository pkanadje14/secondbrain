// agenda.js — the "Today" page data: Google Calendar meetings + Atlassian (Jira)
// tasks. Mock data shaped like the MCP responses so it's a drop-in once the real
// Atlassian + Google Calendar MCP servers are wired.

export const AGENDA = {
  date: "2026-05-29",
  meetings: [
    { id: "m1", title: "Team standup", start: "09:30", end: "09:45", platform: "meet", join: "#", status: "accepted", attendees: ["Owner", "Maya Chen", "Devon R.", "Priya N."], linkedNotes: [] },
    { id: "m2", title: "Receipt latency review", start: "11:00", end: "11:30", platform: "meet", join: "#", status: "accepted", attendees: ["Owner", "Devon R."], linkedNotes: ["n-latency"] },
    { id: "m3", title: "1:1 — Maya", start: "14:00", end: "14:30", platform: "meet", join: "#", status: "accepted", attendees: ["Owner", "Maya Chen"], linkedNotes: ["n-1on1-maya"] },
    { id: "m4", title: "Lifecycle experiment sync", start: "16:00", end: "16:30", platform: "zoom", join: "#", status: "tentative", attendees: ["Owner", "Priya N."], linkedNotes: ["n-points-expiry"] },
  ],
  tasks: [
    { key: "FETCH-1242", title: "Draft points-expiry experiment brief", status: "In Progress", priority: "High", board: "Lifecycle" },
    { key: "FETCH-1208", title: "Fix receipt-scan p95 on older Android", status: "In Progress", priority: "High", board: "Platform" },
    { key: "FETCH-1255", title: "Backfill idempotency-key affected accounts", status: "To Do", priority: "Medium", board: "Platform" },
    { key: "FETCH-1199", title: "Home tile: tone down the receipt count", status: "To Do", priority: "Medium", board: "Growth" },
    { key: "FETCH-1187", title: "Pull dormant cohort size (60–90d)", status: "Done", priority: "Low", board: "Data" },
  ],
};

export function agendaDaySummary() {
  const m = AGENDA.meetings.map((x) => `${x.start}–${x.end} ${x.title}${x.status === "tentative" ? " (tentative)" : ""}`).join("; ");
  const open = AGENDA.tasks.filter((t) => t.status !== "Done");
  const tk = open.map((t) => `${t.key} ${t.title} [${t.status}, ${t.priority}]`).join("; ");
  return `Here is the workspace day (Friday, May 29).\nMeetings: ${m}.\nOpen Jira tasks: ${tk}.`;
}
