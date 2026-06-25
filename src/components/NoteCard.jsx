// NoteCard.jsx — a quiet note card used in surfaced results, "today", recents,
// people/channel grids, and browse. Ported from brain-ui.jsx.

import { Icon, Avatar, sourceMeta } from "./shared.jsx";

export function NoteCard({ note, onOpen, compact }) {
  const m = sourceMeta(note.source);
  const sourceLabel = note.source === "slack" ? "Slack" : m.label;
  const card = (
    <button className={"ncard" + (compact ? " compact" : "") + (note.read ? " read" : "")} onClick={() => onOpen(note)} type="button">
      <div className="ncard-meta">
        <Avatar name={note.person} size={18} />
        <span className="ncard-person">{note.person}</span>
        <span className="ncard-dot">·</span>
        <span className="ncard-src" style={{ color: m.color }}>
          <Icon name={m.icon} size={12} stroke={2.2} /> {note.source === "slack" && note.channel ? note.channel : m.label}
        </span>
        {note.starred ? <span className="ncard-star"><Icon name="star" size={11} stroke={2.4} /> Starred</span> : null}
        {note.importance ? <span className={"ncard-imp imp-" + note.importance}>{note.importance === "project" ? "Project" : "Owner"}</span> : null}
      </div>
      <div className="ncard-title">{note.title}</div>
      {!compact ? <div className="ncard-preview">{note.preview}</div> : null}
    </button>
  );

  // No source link → render the card alone. With a permalink, wrap so the
  // open-in-source affordance is a sibling, not nested inside the button
  // (nested interactive elements are invalid HTML).
  if (!note.permalink) return card;
  return (
    <div className="ncard-wrap">
      {card}
      <a
        className="ncard-open"
        href={note.permalink}
        target="_blank"
        rel="noopener noreferrer"
        title={"Open in " + sourceLabel}
        aria-label={"Open in " + sourceLabel}
      >
        <Icon name="external" size={13} stroke={2.2} />
        <span>Open in {sourceLabel}</span>
      </a>
    </div>
  );
}
