import React from "react";
import { Icon, Avatar } from "./shared.jsx";

/* command palette (⌘K) */
export function Palette({ notes, people, actions, onClose }) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const items = React.useMemo(() => {
    const A = [];
    A.push({ group: "Ask", icon: "sparkle", label: "Ask the workspace brain…", run: () => actions.ask(q || "What needs attention?") });
    A.push({ group: "Browse", icon: "inbox", label: "Browse all notes", run: actions.browse });
    people.forEach((p) => A.push({ group: "People", person: p.name, label: p.name, sub: p.count + " notes", run: () => actions.browsePerson(p.name) }));
    notes.filter((n) => !n.archived).forEach((n) => A.push({ group: "Notes", icon: n.source === "slack" ? "hash" : "vault", label: n.title, sub: n.preview, run: () => actions.openNote(n.id) }));
    if (!q.trim()) return A.filter((it) => it.group !== "Notes").concat(A.filter((it) => it.group === "Notes").slice(0, 4));
    const s = q.toLowerCase();
    return A.filter((it) => (it.label + " " + (it.sub || "")).toLowerCase().includes(s));
  }, [q, notes, people]);

  React.useEffect(() => { setActive(0); }, [q]);
  const run = (it) => { if (it) { it.run(); onClose(); } };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(items[active]); }
    else if (e.key === "Escape") onClose();
  };
  let lastGroup = null;
  return (
    <div className="cmdk-scrim" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Icon name="search" size={20} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search notes, people, or ask…" />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list">
          {items.length === 0 ? <div className="cmdk-none">No matches</div> : null}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <div className="cmdk-group" key={"g" + i}>{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <React.Fragment key={i}>
                {head}
                <button className={"cmdk-item" + (i === active ? " is-active" : "")} onMouseEnter={() => setActive(i)} onClick={() => run(it)} type="button">
                  <span className="cmdk-ico">{it.person ? <Avatar name={it.person} size={22} /> : <Icon name={it.icon} size={18} />}</span>
                  <span className="cmdk-txt">
                    <span className="cmdk-label">{it.label}</span>
                    {it.sub ? <span className="cmdk-sub">{it.sub}</span> : null}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
