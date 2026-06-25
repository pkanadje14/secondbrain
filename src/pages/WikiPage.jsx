// WikiPage.jsx — the compounding-knowledge surface: a wiki browser plus the
// Ingest and Lint operations. Ported from the prototype's wiki.jsx; the
// host-injected window.claude.complete became the app's pluggable complete()
// client (ai.js), and window globals became ES imports.
//
// Pages/log are live from the vault (App sources them from /api/state). Ingest
// persists via onApply (App.applyIngestToVault → backend → Second Brain/wiki/);
// Lint logs via onLog. Everything is vault-backed and survives reloads.

import React from "react";

import { Icon, renderBody, fmtDate } from "../components/shared.jsx";
import { complete } from "../lib/ai.js";
import { WIKI_TYPE, ingestPrompt, lintPrompt, parseJSONReply } from "../data/wiki.js";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const today = () => new Date().toISOString().slice(0, 10);

// The wiki's structured Ingest/Lint operations need a model that returns JSON.
// complete() takes a messages array and resolves to a string.
const askModel = (prompt) => complete({ messages: [{ role: "user", content: prompt }] });

/* wiki body with clickable [[links]] */
function WikiBody({ body, onNav }) {
  return (
    <div className="wk-body" onClick={(e) => {
      if (e.target.classList.contains("md-wiki")) onNav(e.target.textContent);
    }}>{renderBody(body)}</div>
  );
}

/* ---- Ingest panel ---- */
function IngestPanel({ pages, notes, onApply, onClose, initialTitle }) {
  const [pick, setPick] = React.useState("");
  const [title, setTitle] = React.useState(initialTitle || "");
  const [text, setText] = React.useState(initialTitle ? "(describe or paste what " + initialTitle + " should cover)" : "");
  const [busy, setBusy] = React.useState(false);
  const [proposal, setProposal] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [applying, setApplying] = React.useState(false);

  const choose = (id) => {
    setPick(id);
    const n = notes.find((x) => x.id === id);
    if (n) { setTitle(n.title); setText(n.body || n.preview || ""); }
  };

  const process = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null); setProposal(null);
    try {
      const reply = await askModel(ingestPrompt(pages, title || "Untitled source", text));
      const j = parseJSONReply(reply);
      if (!j) { setErr("Couldn't parse the integration plan. Try again."); }
      else setProposal(j);
    } catch (e) { setErr("Something went wrong reaching the model."); }
    setBusy(false);
  };

  const applyProposal = async () => {
    if (applying) return;
    setApplying(true);
    setErr(null);
    try {
      await onApply(proposal, title);
    } catch (e) {
      setErr(`Couldn't apply wiki edits: ${e?.message || "unknown error"}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="wk-pane">
      <div className="wk-pane-head">
        <h2 className="wk-pane-title"><Icon name="inbox" size={18} /> Ingest a source</h2>
        <button className="round-btn" onClick={onClose} type="button"><Icon name="x" size={18} /></button>
      </div>
      <div className="wk-pane-scroll">
        {!proposal ? (
          <>
            <div className="ing-label">Pick an existing note…</div>
            <div className="ing-picks">
              {notes.filter((n) => !n.archived).slice(0, 8).map((n) => (
                <button key={n.id} className={"ing-pick" + (pick === n.id ? " on" : "")} onClick={() => choose(n.id)} type="button">{n.title}</button>
              ))}
            </div>
            <div className="ing-label">…or paste a source</div>
            <input className="ing-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Source title" />
            <textarea className="ing-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an article, message, transcript…" rows={6} />
            {err ? <div className="ing-err">{err}</div> : null}
            <button className="ing-go" onClick={process} disabled={busy || !text.trim()} type="button">
              {busy ? "Reading & integrating…" : <><Icon name="sparkle" size={16} stroke={2.2} /> Propose wiki edits</>}
            </button>
            <p className="ing-hint">The assistant reads the source and proposes how to fold it into the workspace wiki — new pages, updates, and any contradictions. Approval happens before anything changes.</p>
          </>
        ) : (
          <div className="prop">
            <div className="prop-summary">{proposal.summary}</div>
            {proposal.creates && proposal.creates.length ? (
              <div className="prop-block">
                <div className="prop-h"><span className="prop-tag new">New pages</span></div>
                {proposal.creates.map((c, i) => (
                  <div className="prop-card" key={i}>
                    <div className="prop-card-title">{c.title} <span className="prop-type">{c.type}</span></div>
                    <div className="prop-card-body">{renderBody(c.body || "")}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {proposal.updates && proposal.updates.length ? (
              <div className="prop-block">
                <div className="prop-h"><span className="prop-tag upd">Updates</span></div>
                {proposal.updates.map((u, i) => (
                  <div className="prop-line" key={i}><b>{u.title}</b> — {u.change}</div>
                ))}
              </div>
            ) : null}
            {proposal.contradictions && proposal.contradictions.length ? (
              <div className="prop-block">
                <div className="prop-h"><span className="prop-tag warn">Contradictions</span></div>
                {proposal.contradictions.map((c, i) => <div className="prop-line warn" key={i}>{c}</div>)}
              </div>
            ) : null}
            <div className="prop-actions">
              <button className="prop-apply" onClick={applyProposal} disabled={applying} type="button">
                {applying ? "Applying…" : <><Icon name="check" size={16} /> Apply to wiki</>}
              </button>
              <button className="prop-discard" onClick={() => setProposal(null)} disabled={applying} type="button">Back</button>
            </div>
            {err ? <div className="ing-err">{err}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Lint panel ---- */
function LintPanel({ pages, onClose, onLogged, onCreate }) {
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const reply = await askModel(lintPrompt(pages));
      const j = parseJSONReply(reply);
      if (!j) setErr("Couldn't parse the health check. Try again.");
      else { setRes(j); onLogged && onLogged(); }
    } catch (e) { setErr("Something went wrong reaching the model."); }
    setBusy(false);
  };
  React.useEffect(() => { run(); }, []);

  const SECTIONS = [
    { key: "contradictions", label: "Contradictions", icon: "x", cls: "warn" },
    { key: "stale", label: "Stale claims", icon: "clock", cls: "stale" },
    { key: "orphans", label: "Orphan pages", icon: "link", cls: "orphan" },
    { key: "missing", label: "Missing pages", icon: "tag", cls: "missing" },
    { key: "questions", label: "Questions to explore", icon: "sparkle", cls: "q" },
  ];

  return (
    <div className="wk-pane">
      <div className="wk-pane-head">
        <h2 className="wk-pane-title"><Icon name="sparkle" size={18} /> Health check</h2>
        <button className="round-btn" onClick={onClose} type="button"><Icon name="x" size={18} /></button>
      </div>
      <div className="wk-pane-scroll">
        {busy ? <div className="lint-busy"><div className="typing"><span></span><span></span><span></span></div> Auditing the workspace wiki…</div> : null}
        {err ? <div className="ing-err">{err}</div> : null}
        {res ? SECTIONS.map((s) => {
          const items = res[s.key] || [];
          if (!items.length) return null;
          return (
            <div className={"lint-sec " + s.cls} key={s.key}>
              <div className="lint-h"><Icon name={s.icon} size={14} /> {s.label} <span className="lint-n">{items.length}</span></div>
              {items.map((it, i) => (
                <div className="lint-item" key={i}>
                  <span>{it}</span>
                  {s.key === "missing" ? <button className="lint-act" onClick={() => onCreate(it)} type="button">Create</button> : null}
                </div>
              ))}
            </div>
          );
        }) : null}
        {res && !busy ? <button className="ing-go ghost" onClick={run} type="button">Run again</button> : null}
      </div>
    </div>
  );
}

/* ---- Wiki page (the tab) ---- */
export function WikiPage({ pages, log, onApply, onLog, notes, onOpenNote }) {
  const [view, setView] = React.useState("page"); // page | log | ingest | lint
  const [sel, setSel] = React.useState("Overview");
  const [ingestSeed, setIngestSeed] = React.useState(null);

  const byTitle = (t) => pages.find((p) => p.title.toLowerCase() === (t || "").toLowerCase());
  const current = byTitle(sel) || pages[0];
  const backlinks = pages.filter((p) => (p.links || []).some((l) => l.toLowerCase() === (current && current.title.toLowerCase())));

  const groups = [
    { type: "overview", label: "Overview" },
    { type: "concept", label: "Concepts" },
    { type: "entity", label: "Entities" },
  ];

  // Persist the proposal to the vault (App writes the markdown + log, then
  // reloads). Navigate to the first touched page once the vault round-trips.
  const applyIngest = async (proposal, srcTitle) => {
    await onApply(proposal, srcTitle);
    const firstTouched = proposal.creates?.[0]?.title || proposal.updates?.[0]?.title;
    if (firstTouched) setSel(firstTouched);
    setView("page");
  };

  return (
    <div className="page wiki-page">
      <div className="wk-head">
        <div>
          <h1 className="page-title">Wiki</h1>
          <div className="page-sub">{pages.length} pages · maintained by the workspace brain</div>
        </div>
        <div className="wk-actions">
          <button className="wk-btn" onClick={() => { setIngestSeed(null); setView("ingest"); }} type="button"><Icon name="inbox" size={15} /> Ingest</button>
          <button className="wk-btn" onClick={() => setView("lint")} type="button"><Icon name="sparkle" size={15} /> Lint</button>
        </div>
      </div>

      <div className="wk-grid">
        {/* index */}
        <aside className="wk-index">
          {groups.map((g) => {
            const items = pages.filter((p) => p.type === g.type);
            if (!items.length) return null;
            return (
              <div className="wk-group" key={g.type}>
                <div className="wk-group-label">{g.label}</div>
                {items.map((p) => (
                  <button key={p.id} className={"wk-link" + (view === "page" && current && current.id === p.id ? " on" : "")}
                    onClick={() => { setSel(p.title); setView("page"); }} type="button">
                    <span className="wk-dot" style={{ background: WIKI_TYPE[p.type].color }} />{p.title}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="wk-group">
            <div className="wk-group-label">Activity</div>
            <button className={"wk-link" + (view === "log" ? " on" : "")} onClick={() => setView("log")} type="button"><Icon name="clock" size={13} /> Log</button>
          </div>
        </aside>

        {/* main */}
        {view === "ingest" ? (
          <IngestPanel pages={pages} notes={notes} onApply={applyIngest} onClose={() => setView("page")} initialTitle={ingestSeed} />
        ) : view === "lint" ? (
          <LintPanel pages={pages} onClose={() => setView("page")}
            onLogged={() => onLog({ kind: "lint", text: "Health check run" })}
            onCreate={(t) => { setIngestSeed(t); setView("ingest"); }} />
        ) : view === "log" ? (
          <div className="wk-pane">
            <div className="wk-pane-head"><h2 className="wk-pane-title"><Icon name="clock" size={18} /> Log</h2></div>
            <div className="wk-pane-scroll">
              {log.map((e, i) => (
                <div className="log-row" key={i}>
                  <span className={"log-kind k-" + e.kind}>{e.kind}</span>
                  <span className="log-date">{e.date}</span>
                  <span className="log-text" onClick={(ev) => { if (ev.target.classList.contains("md-wiki")) { setSel(ev.target.textContent); setView("page"); } }}>{renderBody(e.text)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : current ? (
          <article className="wk-pane">
            <div className="wk-pane-scroll">
              <span className="wk-type-chip" style={{ color: WIKI_TYPE[current.type].color }}><Icon name={WIKI_TYPE[current.type].icon} size={13} stroke={2.2} /> {WIKI_TYPE[current.type].label}</span>
              <h2 className="wk-title">{current.title}</h2>
              <div className="wk-meta">Updated {fmtDate(current.updated)} · {(current.sources || []).length} {(current.sources || []).length === 1 ? "source" : "sources"}</div>
              <WikiBody body={current.body} onNav={(t) => { if (byTitle(t)) setSel(t); }} />
              {current.sources && current.sources.length ? (
                <div className="wk-sources">
                  <div className="wk-sources-label">Sources</div>
                  {current.sources.map((id) => { const n = notes.find((x) => x.id === id); return n ? (
                    <button key={id} className="wk-source" onClick={() => onOpenNote(id)} type="button"><Icon name={n.source === "slack" ? "hash" : "vault"} size={13} /> {n.title}</button>
                  ) : null; })}
                </div>
              ) : null}
              {backlinks.length ? (
                <div className="wk-backlinks">
                  <div className="wk-sources-label">Linked from</div>
                  {backlinks.map((b) => <button key={b.id} className="wk-backlink" onClick={() => setSel(b.title)} type="button">{b.title}</button>)}
                </div>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
