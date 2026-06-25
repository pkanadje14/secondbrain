import React from "react";
import { Icon } from "../components/shared.jsx";
import { NoteCard } from "../components/NoteCard.jsx";

/* ---------- Channels page ---------- */
export function ChannelsPage({ notes, pageChannel, onPickChannel, onBack, onOpenNote }) {
  const groups = {};
  notes.filter((n) => !n.archived && n.source === "slack").forEach((n) => {
    const c = n.channel || "#slack";
    (groups[c] = groups[c] || []).push(n);
  });
  const obsidian = notes.filter((n) => !n.archived && n.source === "obsidian");
  const names = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

  if (pageChannel) {
    const list = (pageChannel === "Obsidian vault" ? obsidian : groups[pageChannel] || []).
    sort((a, b) => b.pinned - a.pinned || (a.date < b.date ? 1 : -1));
    return (
      <div className="page">
        <button className="page-back" onClick={onBack} type="button"><Icon name="chevronRight" size={15} /> Channels</button>
        <h1 className="page-title">{pageChannel}</h1>
        <div className="page-sub">{list.length} {list.length === 1 ? "note" : "notes"} saved from here</div>
        <div className="page-grid">{list.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}</div>
      </div>);

  }
  return (
    <div className="page">
      <h1 className="page-title">Channels</h1>
      <div className="page-sub">Where workspace notes come from</div>
      <div className="channel-list">
        <button className="channel-row" onClick={() => onPickChannel("Obsidian vault")} type="button">
          <span className="channel-ico ob"><Icon name="vault" size={18} /></span>
          <span className="channel-txt"><span className="channel-name">Obsidian vault</span><span className="channel-sub">Workspace notes</span></span>
          <span className="channel-count">{obsidian.length}</span>
        </button>
        {names.map((c) =>
        <button key={c} className="channel-row" onClick={() => onPickChannel(c)} type="button">
            <span className="channel-ico sl"><Icon name="hash" size={18} /></span>
            <span className="channel-txt"><span className="channel-name">{c}</span><span className="channel-sub">Saved from Slack</span></span>
            <span className="channel-count">{groups[c].length}</span>
          </button>
        )}
      </div>
    </div>);

}
