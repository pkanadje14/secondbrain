// ZoomPage.jsx — the "Meetings" tab: every Zoom meeting in one place, with its
// summary, an interactive to-do list (checking an item writes back to the vault),
// and the full transcript. Data is live from the vault (sb_type: zoom), pulled in
// by the /zoom-to-vault command via the Zoom MCP.

import React from "react";
import { Icon, Avatar, fmtDate, renderBody } from "../components/shared.jsx";

function dateFromIso(iso) {
  if (!iso) return null;
  const date = new Date(iso + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekStartIso(iso) {
  const date = dateFromIso(iso);
  if (!date) return null;
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoFromDate(start);
}

function weekLabel(startIso) {
  const start = dateFromIso(startIso);
  if (!start) return "Unknown week";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", fmt)} - ${end.toLocaleDateString("en-US", fmt)}`;
}

export function ZoomPage({ meetings = [], onToggleTodo }) {
  const [sel, setSel] = React.useState(0);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [weekFilter, setWeekFilter] = React.useState("all");

  const weekOptions = React.useMemo(() => {
    const starts = new Set(meetings.map((m) => weekStartIso(m.date)).filter(Boolean));
    return Array.from(starts)
      .sort((a, b) => b.localeCompare(a))
      .map((start) => ({ value: start, label: weekLabel(start) }));
  }, [meetings]);

  React.useEffect(() => {
    if (weekFilter !== "all" && !weekOptions.some((w) => w.value === weekFilter)) {
      setWeekFilter("all");
    }
  }, [weekFilter, weekOptions]);

  const filteredMeetings = React.useMemo(() => {
    if (weekFilter === "all") return meetings;
    return meetings.filter((meeting) => weekStartIso(meeting.date) === weekFilter);
  }, [meetings, weekFilter]);
  const visibleMeetings = filteredMeetings.length ? filteredMeetings : meetings;

  React.useEffect(() => { setShowTranscript(false); }, [sel]);
  React.useEffect(() => { setSel(0); setShowTranscript(false); }, [weekFilter]);
  React.useEffect(() => {
    if (sel >= visibleMeetings.length) setSel(0);
  }, [sel, visibleMeetings.length]);

  if (!meetings.length) {
    return (
      <div className="page zoom-page">
        <h1 className="page-title">Meetings</h1>
        <div className="page-sub">Zoom meetings — summary, action items, and transcript in one place.</div>
        <div className="page-empty">
          No meetings yet. Run <code>/zoom-to-vault</code> in Claude Code to pull Zoom
          recordings and transcripts into the vault.
        </div>
      </div>
    );
  }

  const m = visibleMeetings[Math.min(sel, visibleMeetings.length - 1)];
  const todos = m.todos || [];
  const openCount = todos.filter((x) => !x.done).length;
  const meetingCount = visibleMeetings.length;
  const meetingLabel = `${meetingCount} ${meetingCount === 1 ? "meeting" : "meetings"}`;

  return (
    <div className="page zoom-page">
      <h1 className="page-title">Meetings</h1>
      <div className="zoom-head-row">
        <div className="page-sub">{meetingLabel} from Zoom</div>
        <label className="zoom-week-filter">
          <span>Week</span>
          <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
            <option value="all">All weeks</option>
            {weekOptions.map((week) => (
              <option key={week.value} value={week.value}>{week.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="zoom-grid">
        {/* meeting list */}
        <aside className="zoom-list">
          {visibleMeetings.map((mt, i) => (
            <button key={mt.id} className={"zoom-item" + (i === sel ? " on" : "")} onClick={() => setSel(i)} type="button">
              <div className="zoom-item-title">{mt.title}</div>
              <div className="zoom-item-meta">
                {fmtDate(mt.date)}{(mt.todos || []).length ? ` · ${(mt.todos || []).filter((x) => !x.done).length} open` : ""}
              </div>
            </button>
          ))}
        </aside>

        {/* detail */}
        <article className="zoom-detail">
          <span className="src-badge" style={{ color: "var(--fetch-sky-70)" }}><Icon name="link" size={14} stroke={2.2} /> Zoom</span>
          <h2 className="zoom-title">{m.title}</h2>
          <div className="zoom-meta">
            {fmtDate(m.date)}{m.start ? ` · ${m.start}` : ""}{m.duration ? ` · ${m.duration}` : ""}
            {todos.length ? ` · ${openCount} open ${openCount === 1 ? "item" : "items"}` : ""}
          </div>

          {(m.participants || []).length ? (
            <div className="zoom-people">
              {m.participants.map((p) => <span key={p} className="zoom-person"><Avatar name={p} size={20} /> {p}</span>)}
            </div>
          ) : null}

          {m.summary ? (
            <div className="zoom-sec">
              <div className="zoom-sec-h"><Icon name="sparkle" size={14} stroke={2.2} /> Summary</div>
              <div className="zoom-summary">{renderBody(m.summary)}</div>
            </div>
          ) : null}

          <div className="zoom-sec">
            <div className="zoom-sec-h"><Icon name="check" size={14} /> To-dos {todos.length ? <span className="zoom-count">{todos.length}</span> : null}</div>
            {todos.length ? (
              <div className="zoom-todos">
                {todos.map((tk, i) => (
                  <button key={i} className={"task-row" + (tk.done ? " done" : "")} onClick={() => onToggleTodo(m.id, i, !tk.done)} type="button">
                    <span className="task-box">{tk.done ? <Icon name="check" size={13} stroke={3} /> : null}</span>
                    <span>{tk.text}</span>
                  </button>
                ))}
              </div>
            ) : <div className="zoom-empty">No action items from this meeting.</div>}
          </div>

          {m.recordingUrl ? (
            <a className="zoom-play" href={m.recordingUrl} target="_blank" rel="noreferrer"><Icon name="link" size={14} /> Open recording</a>
          ) : null}

          {m.transcript ? (
            <div className="zoom-sec">
              <button className="zoom-transcript-toggle" onClick={() => setShowTranscript((v) => !v)} type="button">
                <Icon name={showTranscript ? "chevronRight" : "chevronRight"} size={14} stroke={2.4} style={{ transform: showTranscript ? "rotate(90deg)" : "none" }} />
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </button>
              {showTranscript ? <div className="zoom-transcript">{renderBody(m.transcript)}</div> : null}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}
