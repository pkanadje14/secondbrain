// AgendaPage.jsx — the "Today" page: today's meetings (Google Calendar) on top,
// then Atlassian (Jira) tasks. Meetings also appear on the HMG tab's week calendar;
// here we show just today's. Data is live from the vault backend (agenda.meetings /
// agenda.tasks).

import React from "react";

import { Icon, Avatar } from "../components/shared.jsx";

const STATUS_CLS = { "To Do": "st-todo", "In Progress": "st-prog", "Done": "st-done" };
const PRIO_CLS = { High: "pr-high", Medium: "pr-med", Low: "pr-low" };
const MTG_STATUS = {
  accepted: { label: "Going", cls: "rs-yes", icon: "check" },
  tentative: { label: "Maybe", cls: "rs-maybe", icon: "clock" },
  declined: { label: "Declined", cls: "rs-no", icon: "x" },
};

export function AgendaPage({ agenda, notes = [], onOpenNote, onAskDay }) {
  const meetings = agenda?.meetings || [];
  const tasks = agenda?.tasks || [];
  const open = tasks.filter((t) => t.status !== "Done");
  const done = tasks.filter((t) => t.status === "Done");
  const noteTitle = (id) => { const n = notes.find((x) => x.id === id); return n ? n.title : id; };
  const dateLong = new Date((agenda?.date || new Date().toISOString().slice(0, 10)) + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const empty = meetings.length === 0 && tasks.length === 0;

  return (
    <div className="page agenda">
      <div className="day-head">
        <div>
          <div className="page-sub" style={{ margin: 0 }}>{dateLong}</div>
          <h1 className="page-title">Today</h1>
          <div className="day-stat">{meetings.length} {meetings.length === 1 ? "meeting" : "meetings"} · {open.length} open {open.length === 1 ? "task" : "tasks"}</div>
        </div>
        <button className="day-ask" onClick={onAskDay} type="button"><Icon name="sparkle" size={16} stroke={2.2} /> Ask about the day</button>
      </div>

      {empty ? <div className="page-empty">Nothing scheduled for today. Run <code>/calendar-to-vault</code> in Claude Code to pull the calendar.</div> : null}

      {meetings.length ? <div className="page-label"><Icon name="calendar" size={13} /> Meetings · Google Calendar</div> : null}
      <div className="mtg-list">
        {meetings.map((m) => {
          const rs = MTG_STATUS[m.status] || MTG_STATUS.accepted;
          return (
            <div className={"mtg-item" + (m.status === "tentative" ? " is-tentative" : "")} key={m.id}>
              <div className="mtg-time"><span className="mtg-start">{m.start}</span><span className="mtg-end">{m.end}</span></div>
              <div className="mtg-rail" />
              <div className="mtg-body">
                <div className="mtg-row1">
                  <span className="mtg-title">{m.title}</span>
                  <span className={"rs " + rs.cls}><Icon name={rs.icon} size={12} stroke={2.6} /> {rs.label}</span>
                </div>
                <div className="mtg-meta">
                  <span className="mtg-people">{(m.attendees || []).map((a) => <Avatar key={a} name={a} size={20} />)}</span>
                  {m.join && m.join !== "#" ? (
                    <a className={"mtg-join " + (m.platform || "meet")} href={m.join} target="_blank" rel="noreferrer"><Icon name="link" size={13} /> {m.platform === "zoom" ? "Zoom" : "Google Meet"}</a>
                  ) : null}
                </div>
                {(m.linkedNotes || []).length ? (
                  <div className="mtg-linked">
                    {(m.linkedNotes || []).map((id) => (
                      <button key={id} className="linked-chip" onClick={() => onOpenNote && onOpenNote(id)} type="button"><Icon name="vault" size={12} /> {noteTitle(id)}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {tasks.length ? <div className="page-label"><Icon name="check" size={13} /> Tasks · Atlassian Jira</div> : null}
      <div className="jira-list">
        {open.map((t) => (
          <div className="jira-item" key={t.key}>
            <span className="jira-key">{t.key}</span>
            <span className="jira-title">{t.title}</span>
            <span className="jira-badges">
              <span className={"jira-prio " + PRIO_CLS[t.priority]}>{t.priority}</span>
              <span className="jira-board">{t.board}</span>
              <span className={"jira-status " + STATUS_CLS[t.status]}>{t.status}</span>
            </span>
          </div>
        ))}
        {done.map((t) => (
          <div className="jira-item is-done" key={t.key}>
            <span className="jira-key">{t.key}</span>
            <span className="jira-title">{t.title}</span>
            <span className="jira-badges">
              <span className={"jira-status " + STATUS_CLS[t.status]}><Icon name="check" size={12} stroke={3} /> {t.status}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="agenda-note">Synced from the Obsidian vault. Today's meetings also appear on the HMG week calendar.</div>
    </div>
  );
}
