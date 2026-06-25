import React from "react";
import { Icon, Avatar } from "./shared.jsx";
import { NoteCard } from "./NoteCard.jsx";

const VIEW_FILTERS = [
  { value: "all", label: "All" },
  { value: "starred", label: "Starred" },
  { value: "pinned", label: "Pinned" },
  { value: "archived", label: "Archive" },
];

/* browse drawer — the full list, with people + importance + view filters */
export function BrowsePanel({ notes, people, onOpen, onClose, initialPerson, initialView }) {
  const [q, setQ] = React.useState("");
  const [person, setPerson] = React.useState(initialPerson || null);
  const [importance, setImportance] = React.useState(null);
  const [view, setView] = React.useState(initialView || "all");

  const list = React.useMemo(() => {
    let l = notes.filter((n) => (view === "archived" ? n.archived : !n.archived));
    if (view === "starred") l = l.filter((n) => n.starred);
    if (view === "pinned") l = l.filter((n) => n.pinned);
    if (person) l = l.filter((n) => n.person === person);
    if (importance) l = l.filter((n) => n.importance === importance);
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((n) => [n.title, n.preview, n.body, n.channel, n.tags.join(" ")].join(" ").toLowerCase().includes(s));
    }
    return l.sort((a, b) => (b.starred - a.starred) || (b.pinned - a.pinned) || (a.date < b.date ? 1 : -1));
  }, [notes, q, person, importance, view]);

  return (
    <div className="browse-scrim" onMouseDown={onClose}>
      <aside className="browse" onMouseDown={(e) => e.stopPropagation()}>
        <div className="browse-top">
          <div className="browse-search">
            <Icon name="search" size={18} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every note…" />
          </div>
          <button className="round-btn" onClick={onClose} aria-label="Close" type="button"><Icon name="x" size={20} /></button>
        </div>

        <div className="browse-filters">
          {VIEW_FILTERS.map((filter) => (
            <button key={filter.value} className={"bchip" + (view === filter.value ? " on" : "")} onClick={() => setView(filter.value)} type="button">
              {filter.value === "starred" ? <Icon name="star" size={12} /> : null}
              {filter.label}
            </button>
          ))}
          <span className="bsep" />
          <button className={"bchip" + (importance === "project" ? " on" : "")} onClick={() => setImportance(importance === "project" ? null : "project")} type="button"><Icon name="target" size={12} /> Project</button>
          <button className={"bchip" + (importance === "personal" ? " on" : "")} onClick={() => setImportance(importance === "personal" ? null : "personal")} type="button"><Icon name="star" size={12} /> Owner</button>
        </div>

        <div className="browse-people">
          {people.map((p) => (
            <button key={p.name} className={"bperson" + (person === p.name ? " on" : "")} onClick={() => setPerson(person === p.name ? null : p.name)} type="button">
              <Avatar name={p.name} size={22} /> {p.name.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="browse-list">
          {list.length === 0 ? <div className="browse-empty">Nothing here. Try clearing a filter.</div> :
            list.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpen} />)}
        </div>
      </aside>
    </div>
  );
}

/* people cluster in the header */
export function PeopleCluster({ people, onPick }) {
  return (
    <div className="people-cluster">
      {people.slice(0, 6).map((p) => (
        <button key={p.name} className="pc-av" onClick={() => onPick(p.name)} title={p.name} type="button">
          <Avatar name={p.name} size={28} />
        </button>
      ))}
    </div>
  );
}
