import React from "react";
import { Icon, Avatar, personOf } from "../components/shared.jsx";
import { NoteCard } from "../components/NoteCard.jsx";
import { isOwnerName } from "../lib/identity.js";

// Build the copyable ID rows for a profile: prod/stage × fetch/personal. Only
// rows with a value render. Falls back to the legacy single prodId/stageId.
function idRowsFor(p) {
  return [
    { env: "prod", kind: "Fetch", value: p.prodFetchId ?? p.prodId },
    { env: "prod", kind: "Personal", value: p.prodPersonalId },
    { env: "stage", kind: "Fetch", value: p.stageFetchId ?? p.stageId },
    { env: "stage", kind: "Personal", value: p.stagePersonalId },
  ].filter((r) => r.value);
}

/* ---------- People page ---------- */
export function PeoplePage({ people, hiddenPeople = [], notes, pagePerson, onPickPerson, onBack, onOpenNote, onHidePerson, canHide }) {
  if (pagePerson) {
    const p = personOf(pagePerson);
    const isHidden = hiddenPeople.some((x) => x.name === pagePerson);
    const mine = notes.filter((n) => !n.archived && n.person === pagePerson).
    sort((a, b) => b.pinned - a.pinned || (a.date < b.date ? 1 : -1));
    const proj = mine.filter((n) => n.importance === "project");
    const pers = mine.filter((n) => n.importance !== "project");
    return (
      <div className="page">
        <button className="page-back" onClick={onBack} type="button"><Icon name="chevronRight" size={15} /> People</button>
        <div className="profile-card">
          <div className="profile-top">
            <Avatar name={pagePerson} size={64} />
            <div className="profile-id">
              <h1 className="profile-name">{pagePerson}</h1>
              <div className="profile-title">
                {p.title || p.role}
                {p.handle ? <span className="profile-handle">{p.handle}</span> : null}
                {p.tz ? <span className="profile-tz">{p.tz}</span> : null}
              </div>
            </div>
          </div>
          {p.desc ? <p className="profile-desc">{p.desc}</p> : null}
          {idRowsFor(p).length ? (
            <div className="profile-ids">
              {idRowsFor(p).map((r) => (
                <div className="id-row" key={r.env + r.kind}>
                  <span className="id-label"><span className={"id-env " + r.env}>{r.env}</span> {r.kind} ID</span>
                  <code className="id-val">{r.value}</code>
                  <button className="id-copy" onClick={() => navigator.clipboard && navigator.clipboard.writeText(r.value)} title="Copy" type="button"><Icon name="link" size={13} /></button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="profile-stat">{mine.length} {mine.length === 1 ? "note" : "notes"} · {proj.length} for the project</div>
          {canHide && !isOwnerName(pagePerson) ? (
            <div className="profile-actions">
              <button className={"ract" + (isHidden ? " on" : "")} onClick={() => onHidePerson(pagePerson, !isHidden)} type="button">
                <Icon name={isHidden ? "users" : "x"} size={15} /> {isHidden ? "Show in People" : "Hide from People"}
              </button>
            </div>
          ) : null}
        </div>
        {proj.length ? <><div className="page-label"><Icon name="target" size={13} /> For the project</div><div className="page-grid">{proj.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}</div></> : null}
        {pers.length ? <><div className="page-label"><Icon name="star" size={13} /> Owner notes</div><div className="page-grid">{pers.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}</div></> : null}
        {mine.length === 0 ? <div className="page-empty">No notes from {pagePerson} yet.</div> : null}
      </div>);

  }
  return (
    <div className="page">
      <h1 className="page-title">People</h1>
      <div className="page-sub">Everyone in the workspace brain</div>
      <div className="people-grid">
        {people.map((p) =>
        <button key={p.name} className="person-card" onClick={() => onPickPerson(p.name)} type="button">
            <Avatar name={p.name} size={46} />
            <div className="person-card-name">{p.name}</div>
            <div className="person-card-role">{personOf(p.name).role || "—"}</div>
            <div className="person-card-count">{p.count} {p.count === 1 ? "note" : "notes"}</div>
          </button>
        )}
      </div>

      {hiddenPeople.length ? (
        <>
          <div className="page-label"><Icon name="x" size={13} /> Hidden</div>
          <div className="people-grid">
            {hiddenPeople.map((p) => (
              <div key={p.name} className="person-card is-hidden">
                <button className="person-card-open" onClick={() => onPickPerson(p.name)} type="button">
                  <Avatar name={p.name} size={46} />
                  <div className="person-card-name">{p.name}</div>
                  <div className="person-card-role">{personOf(p.name).role || "—"}</div>
                  <div className="person-card-count">{p.count} {p.count === 1 ? "note" : "notes"}</div>
                </button>
                {canHide ? (
                  <button className="person-unhide" onClick={() => onHidePerson(p.name, false)} type="button">
                    <Icon name="users" size={13} /> Unhide
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>);

}
