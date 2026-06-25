// graph-view.jsx — the knowledge graph as an EMBEDDED page component.
// Same force sim + interactions as the standalone, but takes notes/daily/people
// + mutation callbacks as props so it shares state with the brain app.
// Reuses Icon, Avatar, personOf, fmtDate, renderBody, SOURCE_META (shared.jsx),
// buildGraph/nodesForNotes (graph-build.jsx), brainContext/relatedNotes/brainReply.

import React from "react";
import { Icon, fmtDate, personOf, Avatar, sourceMeta, NoteBody, renderInline, findNoteByRef } from "../components/shared.jsx";
import { buildGraph, nodesForNotes } from "../lib/graph.js";
import { brainContext, relatedNotes, brainReply } from "../lib/brain.jsx";
import { complete } from "../lib/ai.js";

const { useState: gvS, useRef: gvR, useEffect: gvE, useMemo: gvM } = React;

function gvMakeSim(nodes, links) {
  const REPULSION = 6600, LINK_K = 0.035, CENTER_K = 0.013, DAMP = 0.9;
  const linkDist = (l) => 58 + ((l._s.r || 8) + (l._t.r || 8));
  const map = {}; nodes.forEach((n) => (map[n.id] = n));
  links.forEach((l) => { l._s = map[l.source]; l._t = map[l.target]; });
  let alpha = 1;
  const reheat = (v = 0.9) => { alpha = Math.max(alpha, v); };
  const step = () => {
    if (alpha < 0.005) return false;
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 90000) continue;
        const f = REPULSION / d2; const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    links.forEach((l) => {
      const a = l._s, b = l._t; if (!a || !b) return;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const diff = (d - linkDist(l)) / d * LINK_K;
      const fx = dx * diff, fy = dy * diff;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach((nd) => {
      nd.vx += -nd.x * CENTER_K; nd.vy += -nd.y * CENTER_K;
      if (nd.fx != null) { nd.x = nd.fx; nd.y = nd.fy; nd.vx = 0; nd.vy = 0; return; }
      nd.vx *= DAMP; nd.vy *= DAMP;
      nd.x += nd.vx * alpha * 1.6; nd.y += nd.vy * alpha * 1.6;
    });
    alpha *= 0.985;
    return true;
  };
  return { step, reheat, get alpha() { return alpha; } };
}

function GvNoteDetail({ note, onPin, onArchive, onToggleDone, onToggleTask, onSetImportance, onWikiLink, readOnly, canArchive }) {
  const m = sourceMeta(note.source);
  return (
    <>
      <span className="src-badge" style={{ color: m.color }}><Icon name={m.icon} size={14} stroke={2.2} /> {note.source === "slack" && note.channel ? note.channel : m.label}</span>
      <h2 className="sp-title">{note.title}</h2>
      <div className="sp-sender">
        <Avatar name={note.person} size={28} />
        <div><div className="sp-name">{note.person}</div><div className="sp-role">{personOf(note.person).role} · {fmtDate(note.date)}</div></div>
      </div>
      {note.permalink ? (
        <a className="reader-open" href={note.permalink} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={14} stroke={2.2} /> Open in {m.label}
        </a>
      ) : null}
      {!readOnly ? (
        <div className="sp-imp">
          <button className={"imp-pick" + (note.importance === "project" ? " on-project" : "")} onClick={() => onSetImportance(note.id, note.importance === "project" ? null : "project")} type="button"><Icon name="target" size={14} /> Project</button>
          <button className={"imp-pick" + (note.importance === "personal" ? " on-personal" : "")} onClick={() => onSetImportance(note.id, note.importance === "personal" ? null : "personal")} type="button"><Icon name="star" size={14} /> Owner</button>
        </div>
      ) : note.importance ? (
        <div className="sp-imp">
          <span className={"imp-pick on-" + note.importance}><Icon name={note.importance === "project" ? "target" : "star"} size={14} /> {note.importance === "project" ? "Project" : "Owner"}</span>
        </div>
      ) : null}
      {note.tasks ? (
        <div className="sp-tasks" onClick={(e) => { if (onWikiLink && e.target.classList.contains("md-wiki")) { e.stopPropagation(); onWikiLink(e.target.textContent); } }}>
          {note.tasks.map((tk, i) => (
            readOnly ? (
              <div className={"task-row" + (tk.done ? " done" : "")} key={i}>
                <span className="task-box">{tk.done ? <Icon name="check" size={13} stroke={3} /> : null}</span><span>{renderInline(tk.text)}</span>
              </div>
            ) : (
              <button className={"task-row" + (tk.done ? " done" : "")} key={i} onClick={() => onToggleTask(note.id, i)} type="button">
                <span className="task-box">{tk.done ? <Icon name="check" size={13} stroke={3} /> : null}</span><span>{tk.text}</span>
              </button>
            )
          ))}
        </div>
      ) : null}
      <NoteBody className="sp-body" body={note.body} onWikiLink={onWikiLink} />
      {note.tags && note.tags.length ? <div className="sp-tags">{note.tags.map((tg) => <span className="rtag" key={tg}>#{tg}</span>)}</div> : null}
      {!readOnly ? (
        <div className="sp-actions">
          <button className={"ract" + (note.pinned ? " on" : "")} onClick={() => onPin(note.id)} type="button"><Icon name="pin" size={16} /> {note.pinned ? "Pinned" : "Pin"}</button>
          <button className={"ract" + (note.done ? " on" : "")} onClick={() => onToggleDone(note.id)} type="button"><Icon name="check" size={16} /> {note.done ? "Done" : "Done?"}</button>
          <button className="ract" onClick={() => onArchive(note.id, !note.archived)} type="button"><Icon name="archive" size={16} /> {note.archived ? "Unarchive" : "Archive"}</button>
        </div>
      ) : null}
      {readOnly && canArchive ? (
        <div className="sp-actions">
          <button className={"ract" + (note.archived ? " on" : "")} onClick={() => onArchive(note.id, !note.archived)} type="button"><Icon name="archive" size={16} /> {note.archived ? "Unarchive" : "Archive"}</button>
        </div>
      ) : null}
    </>
  );
}

function GvEntityDetail({ node, notes, onOpenNote }) {
  const isPerson = node.type === "person";
  const related = isPerson
    ? notes.filter((n) => !n.archived && n.person === node.meta.name)
    : notes.filter((n) => !n.archived && (n.tags || []).includes(node.meta.tag));
  return (
    <>
      <span className="src-badge" style={{ color: node.color }}><Icon name={isPerson ? "users" : "tag"} size={14} stroke={2.2} /> {isPerson ? "Person" : "Concept"}</span>
      <div className="sp-entity-head">
        {isPerson ? <Avatar name={node.meta.name} size={44} /> : <span className="sp-concept-orb" style={{ background: node.color }}><Icon name="tag" size={20} /></span>}
        <div><h2 className="sp-title sp-title-tight">{node.label}</h2><div className="sp-role">{isPerson ? node.meta.role + " · " + node.meta.count + " notes" : related.length + " notes mention this"}</div></div>
      </div>
      <div className="sp-entity-label">Connected notes</div>
      <div className="sp-related">
        {related.map((n) => {
          const m = sourceMeta(n.source);
          return (
            <button key={n.id} className="rel-card" onClick={() => onOpenNote(n.id)} type="button">
              <span className="rel-dot" style={{ background: m.color }} />
              <span className="rel-txt"><span className="rel-title">{n.title}</span><span className="rel-sub">{n.source === "slack" && n.channel ? n.channel : m.label} · {fmtDate(n.date)}</span></span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function GraphView({ notes, daily, people, onPin, onArchive, onToggleDone, onToggleTask, onSetImportance, readOnly, canArchive }) {
  const [selected, setSelected] = gvS(null);
  const [query, setQuery] = gvS("");
  const [ask, setAsk] = gvS("");
  const [answer, setAnswer] = gvS(null);
  const [busy, setBusy] = gvS(false);
  const [highlight, setHighlight] = gvS(null);

  const svgRef = gvR(null), worldRef = gvR(null);
  const nodeEls = gvR({}), linkEls = gvR({}), labelEls = gvR({});
  const view = gvR({ k: 1, tx: 0, ty: 0 });
  const simRef = gvR(null), nodesRef = gvR([]);
  const drag = gvR(null), pan = gvR(null);

  const allNotes = [daily, ...notes];
  const noteObj = (nid) => allNotes.find((n) => n.id === nid) || null;

  const graph = gvM(() => {
    const g = buildGraph(notes, daily, people);
    const prev = {}; nodesRef.current.forEach((n) => (prev[n.id] = n));
    g.nodes.forEach((n, i) => {
      const old = prev[n.id];
      if (old) { n.x = old.x; n.y = old.y; n.vx = old.vx; n.vy = old.vy; }
      else { const a = (i / g.nodes.length) * Math.PI * 2; n.x = Math.cos(a) * 180 + (Math.random() - .5) * 40; n.y = Math.sin(a) * 180 + (Math.random() - .5) * 40; n.vx = 0; n.vy = 0; }
    });
    nodesRef.current = g.nodes;
    return g;
  }, [notes, daily, people]);

  gvE(() => {
    simRef.current = gvMakeSim(graph.nodes, graph.links);
    simRef.current.reheat(1);
    let raf;
    const draw = () => {
      simRef.current.step();
      graph.nodes.forEach((nd) => {
        const el = nodeEls.current[nd.id]; if (el) el.setAttribute("transform", `translate(${nd.x},${nd.y})`);
        const lb = labelEls.current[nd.id]; if (lb) lb.setAttribute("transform", `translate(${nd.x},${nd.y + nd.r + 13})`);
      });
      graph.links.forEach((l, i) => {
        const ln = linkEls.current[i];
        if (ln && l._s && l._t) { ln.setAttribute("x1", l._s.x); ln.setAttribute("y1", l._s.y); ln.setAttribute("x2", l._t.x); ln.setAttribute("y2", l._t.y); }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [graph]);

  gvE(() => {
    const fit = () => { if (!svgRef.current) return; const r = svgRef.current.getBoundingClientRect(); view.current.tx = r.width / 2; view.current.ty = r.height / 2; applyView(); };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, []);

  const applyView = () => { const v = view.current; if (worldRef.current) worldRef.current.setAttribute("transform", `translate(${v.tx},${v.ty}) scale(${v.k})`); };
  const toWorld = (cx, cy) => { const r = svgRef.current.getBoundingClientRect(); const v = view.current; return { x: (cx - r.left - v.tx) / v.k, y: (cy - r.top - v.ty) / v.k }; };

  const onDownNode = (e, nd) => {
    e.stopPropagation();
    const p = toWorld(e.clientX, e.clientY);
    drag.current = { nd, dx: nd.x - p.x, dy: nd.y - p.y, moved: false };
    nd.fx = nd.x; nd.fy = nd.y;
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };
  const onDownBg = (e) => {
    pan.current = { x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty, moved: false };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };
  const onMove = (e) => {
    if (drag.current) {
      const p = toWorld(e.clientX, e.clientY);
      drag.current.nd.fx = p.x + drag.current.dx; drag.current.nd.fy = p.y + drag.current.dy;
      drag.current.moved = true; simRef.current.reheat(0.5);
    } else if (pan.current) {
      view.current.tx = pan.current.tx + (e.clientX - pan.current.x);
      view.current.ty = pan.current.ty + (e.clientY - pan.current.y);
      pan.current.moved = true; applyView();
    }
  };
  const onUp = () => {
    if (drag.current) { const { nd, moved } = drag.current; nd.fx = null; nd.fy = null; if (!moved) setSelected(nd.id); drag.current = null; }
    else if (pan.current) { if (!pan.current.moved) { setSelected(null); setAnswer(null); setHighlight(null); } pan.current = null; }
    window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
  };
  const onWheel = (e) => {
    e.preventDefault();
    const v = view.current; const r = svgRef.current.getBoundingClientRect();
    const pointerX = e.clientX - r.left;
    const pointerY = e.clientY - r.top;
    const k2 = Math.min(2.4, Math.max(0.4, v.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    v.tx = pointerX - (pointerX - v.tx) * (k2 / v.k); v.ty = pointerY - (pointerY - v.ty) * (k2 / v.k); v.k = k2; applyView();
  };

  const searchSet = gvM(() => {
    const q = query.trim().toLowerCase(); if (!q) return null;
    const ids = new Set();
    graph.nodes.forEach((nd) => {
      let hay = nd.label.toLowerCase();
      if (nd.type === "note") { const n = noteObj(nd.noteId); if (n) hay += " " + n.preview + " " + (n.tags || []).join(" ") + " " + n.person; }
      if (hay.includes(q)) ids.add(nd.id);
    });
    return ids;
  }, [query, graph]);

  const activeSet = gvM(() => {
    if (selected) { const s = new Set([selected]); graph.adj[selected] && graph.adj[selected].forEach((x) => s.add(x)); return s; }
    if (highlight) return highlight;
    if (searchSet) return searchSet;
    return null;
  }, [selected, highlight, searchSet, graph]);

  const runAsk = async (text) => {
    const q = (text || ask).trim(); if (!q || busy) return;
    setBusy(true); setAnswer({ text: "", noteIds: [], q }); setSelected(null);
    try {
      const ctx = brainContext(notes, daily);
      const reply = ((await complete({ messages: [
        { role: "user", content: ctx }, { role: "assistant", content: "Got it." }, { role: "user", content: q },
      ] })) || "").trim();
      const rel = relatedNotes(notes, q, reply).map((n) => n.id);
      setAnswer({ text: reply || "No matching workspace notes found.", noteIds: rel, q });
      setHighlight(nodesForNotes(graph, rel, notes));
      simRef.current && simRef.current.reheat(0.4);
    } catch (e) { setAnswer({ text: "Something went wrong reaching the workspace brain. Try again.", noteIds: [], q }); }
    setBusy(false);
  };

  const selNode = selected ? graph.byId[selected] : null;
  const selNote = selNode && selNode.type === "note" ? noteObj(selNode.noteId) : null;
  const dimmed = (id) => activeSet && !activeSet.has(id);
  const ASK_SUGGEST = ["What needs attention this week?", "How is Maya connected to the work?", "Summarize the points work"];

  return (
    <div className="gembed">
      {/* toolbar */}
      <div className="gbar">
        <label className="gsearch">
          <Icon name="search" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the graph…" />
          {query ? <button className="gsearch-x" onClick={() => setQuery("")} type="button"><Icon name="x" size={15} /></button> : null}
        </label>
        <div className="gbar-meta">{graph.nodes.length} nodes · {graph.links.length} links</div>
        <div className="glegend">
          <span><i style={{ background: "var(--accent)" }} /> Obsidian</span>
          <span><i style={{ background: "var(--fetch-teal-50)" }} /> Slack</span>
          <span><i style={{ background: "var(--fetch-orange-50)" }} /> Concept</span>
          <span><i className="leg-ring" /> Person</span>
        </div>
      </div>

      {/* canvas */}
      <svg ref={svgRef} className="gcanvas" onPointerDown={onDownBg} onWheel={onWheel}>
        <g ref={worldRef}>
          {graph.links.map((l, i) => (
            <line key={i} ref={(el) => (linkEls.current[i] = el)} className={"glink" + (activeSet && activeSet.has(l.source) && activeSet.has(l.target) ? " on" : "") + (activeSet ? " dimmable" : "")} />
          ))}
          {graph.nodes.map((nd) => (
            <g key={nd.id} ref={(el) => (nodeEls.current[nd.id] = el)} className={"gnode t-" + nd.type + (selected === nd.id ? " sel" : "") + (dimmed(nd.id) ? " dim" : "") + (highlight && highlight.has(nd.id) ? " pulse" : "")} onPointerDown={(e) => onDownNode(e, nd)}>
              {nd.type === "person" ? (
                <>
                  <circle className="ncirc" r={nd.r} fill={nd.color} />
                  <text className="ninit" textAnchor="middle" dominantBaseline="central" dy="0.5">{personOf(nd.meta.name).initials}</text>
                </>
              ) : nd.daily ? (
                <circle className="ncirc daily" r={nd.r} fill={nd.color} />
              ) : (
                <circle className="ncirc" r={nd.r} fill={nd.color} fillOpacity={nd.type === "note" ? 0.92 : 0.95} />
              )}
            </g>
          ))}
          {graph.nodes.filter((n) => n.type !== "note").map((nd) => (
            <text key={"l" + nd.id} ref={(el) => (labelEls.current[nd.id] = el)} className={"glabel gl-" + nd.type + (dimmed(nd.id) ? " dim" : "")} textAnchor="middle">{nd.label}</text>
          ))}
        </g>
      </svg>

      {!selected && !answer ? <div className="ghint">Drag to explore · scroll to zoom · click a node to open it · ask below</div> : null}

      {/* ask dock */}
      <div className={"gask" + (answer ? " has-answer" : "")}>
        {answer ? (
          <div className="gans">
            <button className="gans-x" onClick={() => { setAnswer(null); setHighlight(null); }} type="button"><Icon name="x" size={16} /></button>
            <div className="gans-q">{answer.q}</div>
            {busy && !answer.text ? <div className="typing"><span></span><span></span><span></span></div> : <div className="gans-text">{brainReply(answer.text)}</div>}
            {answer.noteIds && answer.noteIds.length ? (
              <div className="gans-notes">
                <span className="gans-notes-label">Lit up {answer.noteIds.length} connected {answer.noteIds.length === 1 ? "node" : "nodes"}</span>
                <div className="gans-chips">{answer.noteIds.map((id) => { const n = noteObj(id); return n ? <button key={id} className="gans-chip" onClick={() => setSelected("note:" + id)} type="button">{n.title}</button> : null; })}</div>
              </div>
            ) : null}
          </div>
        ) : null}
        <form className="gask-bar" onSubmit={(e) => { e.preventDefault(); runAsk(); }}>
          <span className="gask-spark"><Icon name="sparkle" size={16} stroke={2.2} /></span>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask the workspace brain — nodes will light up…" />
          {!ask && !answer ? <div className="gask-suggest">{ASK_SUGGEST.map((s) => <button key={s} type="button" onClick={() => { setAsk(s); runAsk(s); }}>{s}</button>)}</div> : null}
          <button className="gask-send" type="submit" disabled={busy || !ask.trim()} aria-label="Ask"><Icon name="chevronRight" size={19} stroke={2.4} /></button>
        </form>
      </div>

      {/* side panel */}
      {selNode ? (
        <aside className="gside" key={selNode.id}>
          <button className="gside-x" onClick={() => setSelected(null)} type="button"><Icon name="x" size={20} /></button>
          <div className="gside-scroll">
            {selNote ? <GvNoteDetail note={selNote} readOnly={readOnly} canArchive={canArchive} onPin={onPin} onArchive={(id, archived) => { onArchive(id, archived); setSelected(null); }} onToggleDone={onToggleDone} onToggleTask={onToggleTask} onSetImportance={onSetImportance} onWikiLink={(text) => { const hit = findNoteByRef(notes, text); if (hit) setSelected("note:" + hit.id); }} />
              : <GvEntityDetail node={selNode} notes={notes} onOpenNote={(id) => setSelected("note:" + id)} />}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
