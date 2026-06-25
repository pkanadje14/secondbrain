import React from "react";
import { Icon, fmtDate, personOf, Avatar, sourceMeta, NoteBody, renderInline } from "./shared.jsx";

/* full note reader — calm right slide-over */
export function Reader({ note, onClose, onPin, onArchive, onMarkRead, onStar, onToggleDone, onToggleTask, onSetImportance, onWikiLink, readOnly, canArchive, canStar, canToggleTasks }) {
  if (!note) return null;
  const m = sourceMeta(note.source);
  return (
    <div className="reader-scrim" onMouseDown={onClose}>
      <aside className="reader" onMouseDown={(e) => e.stopPropagation()}>
        <div className="reader-top">
          <span className="src-badge" style={{ color: m.color }}>
            <Icon name={m.icon} size={14} stroke={2.2} /> {note.source === "slack" && note.channel ? note.channel : m.label}
          </span>
          <button className="round-btn" onClick={onClose} aria-label="Close" type="button"><Icon name="x" size={20} /></button>
        </div>
        <div className="reader-scroll">
          <h2 className={"reader-title" + (note.read ? " read" : "")}>{note.title}</h2>
          <div className="reader-sender">
            <Avatar name={note.person} size={30} />
            <div>
              <div className="reader-name">{note.person}</div>
              <div className="reader-role">{personOf(note.person).role} · {fmtDate(note.date)}</div>
            </div>
          </div>

          {note.permalink ? (
            <a className="reader-open" href={note.permalink} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={14} stroke={2.2} /> Open in {m.label}
            </a>
          ) : null}

          {!readOnly ? (
            <div className="reader-imp">
              <button className={"imp-pick" + (note.importance === "project" ? " on-project" : "")} onClick={() => onSetImportance(note.id, note.importance === "project" ? null : "project")} type="button"><Icon name="target" size={14} /> Project</button>
              <button className={"imp-pick" + (note.importance === "personal" ? " on-personal" : "")} onClick={() => onSetImportance(note.id, note.importance === "personal" ? null : "personal")} type="button"><Icon name="star" size={14} /> Owner</button>
            </div>
          ) : note.importance ? (
            <div className="reader-imp">
              <span className={"imp-pick on-" + note.importance}><Icon name={note.importance === "project" ? "target" : "star"} size={14} /> {note.importance === "project" ? "Project" : "Owner"}</span>
            </div>
          ) : null}

          {note.tasks ? (
            <div className="reader-tasks" onClick={(e) => { if (onWikiLink && e.target.classList.contains("md-wiki")) { e.stopPropagation(); onWikiLink(e.target.textContent); } }}>
              {note.tasks.map((t, i) => (
                readOnly && !canToggleTasks ? (
                  <div className={"task-row" + (t.done ? " done" : "")} key={i}>
                    <span className="task-box">{t.done ? <Icon name="check" size={13} stroke={3} /> : null}</span>
                    <span>{renderInline(t.text)}</span>
                  </div>
                ) : (
                  <button className={"task-row" + (t.done ? " done" : "")} key={i} onClick={() => onToggleTask && onToggleTask(note.id, i)} type="button">
                    <span className="task-box">{t.done ? <Icon name="check" size={13} stroke={3} /> : null}</span>
                    <span>{t.text}</span>
                  </button>
                )
              ))}
            </div>
          ) : null}

          <NoteBody className="reader-body" body={note.body} onWikiLink={onWikiLink} />

          {note.tags && note.tags.length ? (
            <div className="reader-tags">{note.tags.map((t) => <span className="rtag" key={t}>#{t}</span>)}</div>
          ) : null}
        </div>
        {readOnly ? null : (
          <div className="reader-actions">
            {onStar ? <button className={"ract" + (note.starred ? " on" : "")} onClick={() => onStar(note.id, !note.starred)} type="button"><Icon name="star" size={17} /> {note.starred ? "Starred" : "Star"}</button> : null}
            <button className={"ract" + (note.pinned ? " on" : "")} onClick={() => onPin(note.id)} type="button"><Icon name="pin" size={17} /> {note.pinned ? "Pinned" : "Pin"}</button>
            <button className={"ract" + (note.done ? " on" : "")} onClick={() => onToggleDone(note.id)} type="button"><Icon name="check" size={17} /> {note.done ? "Done" : "Mark done"}</button>
            <button className="ract" onClick={() => onArchive(note.id, !note.archived)} type="button"><Icon name="archive" size={17} /> {note.archived ? "Unarchive" : "Archive"}</button>
          </div>
        )}
        {readOnly && (canArchive || canStar || onMarkRead) ? (
          <div className="reader-actions">
            {canStar && onStar ? (
              <button className={"ract" + (note.starred ? " on" : "")} onClick={() => onStar(note.id, !note.starred)} type="button"><Icon name="star" size={17} /> {note.starred ? "Starred" : "Star"}</button>
            ) : null}
            {onMarkRead ? (
              <button className={"ract" + (note.read ? " on" : "")} onClick={() => onMarkRead(note.id, !note.read)} type="button"><Icon name="check" size={17} /> {note.read ? "Read" : "Mark as read"}</button>
            ) : null}
            {canArchive ? (
              <button className={"ract" + (note.archived ? " on" : "")} onClick={() => onArchive(note.id, !note.archived)} type="button"><Icon name="archive" size={17} /> {note.archived ? "Unarchive" : "Archive"}</button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
