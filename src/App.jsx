// App.jsx — assistant-first "second brain". Reads everything live from the
// Obsidian vault (via the backend) and renders it read-only. Claude Code is the
// only writer; the UI refreshes automatically when the vault changes.

import React from "react";

import { useVault } from "./hooks/useVault.js";
import { saveWikiPage, saveNoteToVault, appendLog, setNoteArchived, setNoteRead, setNoteStarred, toggleDailyTask, toggleZoomTodo, setPersonHidden } from "./lib/vaultClient.js";
import { personaEssence, brainContext, relatedNotes, brainReply } from "./lib/brain.jsx";
import { complete } from "./lib/ai.js";
import { OWNER_NAME, isOwnerName } from "./lib/identity.js";

import { Icon, BrainMark, findNoteByRef } from "./components/shared.jsx";
import { NoteCard } from "./components/NoteCard.jsx";
import { Reader } from "./components/Reader.jsx";
import { BrowsePanel, PeopleCluster } from "./components/BrowsePanel.jsx";
import { Palette } from "./components/Palette.jsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakColor,
} from "./components/Tweaks.jsx";

import { HomeCommandCenter } from "./pages/HomeCommandCenter.jsx";
import { PeoplePage } from "./pages/PeoplePage.jsx";
import { ChannelsPage } from "./pages/ChannelsPage.jsx";
import { GraphView } from "./pages/GraphView.jsx";
import { WikiPage } from "./pages/WikiPage.jsx";
import { ZoomPage } from "./pages/ZoomPage.jsx";
import { AnthropicNewsPage } from "./pages/AnthropicNewsPage.jsx";

const BRAIN_TWEAKS = { dark: false, accent: "#7A45FF" };

const BRAIN_SUGGEST = [
  "What needs attention this week?",
  "Summarize project notes",
  "Who is collaborating most?",
  "What's important right now?",
];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}

function FirstRunEmptyState({ onRetry }) {
  const steps = [
    { command: "npm run setup", label: "Create backend env" },
    { command: "VAULT_PATH=/absolute/path/to/Obsidian Vault", label: "Configure vault root" },
    { command: "npm run setup:vault", label: "Create the vault surface" },
    { command: "npm run dev:all", label: "Start the local app" },
  ];

  return (
    <div className="setup-empty">
      <div className="setup-empty-mark"><Icon name="vault" size={24} stroke={2.2} /></div>
      <h1>Workspace vault is ready for setup</h1>
      <p>The backend is connected, but this vault does not have workspace notes yet.</p>
      <div className="setup-steps">
        {steps.map((step) => (
          <div className="setup-step" key={step.command}>
            <code>{step.command}</code>
            <span>{step.label}</span>
          </div>
        ))}
      </div>
      <button className="setup-retry" onClick={onRetry} type="button">
        <Icon name="check" size={14} stroke={2.6} /> Check again
      </button>
    </div>
  );
}

const READ_ONLY = true; // vault is the source of truth; Claude Code is the writer.
const ARCHIVE_ENABLED = true; // archive is the one in-UI mutation: it writes `archived` back to the vault.

export default function App() {
  const [t, setTweak] = useTweaks(BRAIN_TWEAKS);
  const { data, loading, error, reload } = useVault();

  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [readerId, setReaderId] = React.useState(null);
  const [browse, setBrowse] = React.useState(false);
  const [browsePerson, setBrowsePerson] = React.useState(null);
  const [browseView, setBrowseView] = React.useState("all");
  const [palette, setPalette] = React.useState(false);
  const [page, setPage] = React.useState("home");
  const [pagePerson, setPagePerson] = React.useState(null);
  const [pageChannel, setPageChannel] = React.useState(null);
  const scrollRef = React.useRef(null);

  const [savedFlash, setSavedFlash] = React.useState(false);

  // Wiki + its log are now live from the vault (Second Brain/wiki/ + log.md).
  // Ingest/Lint/save-answer persist real markdown via the backend; SSE refreshes.
  const zoomMeetings = data?.zoom || [];
  const wikiPages = data?.wiki || [];
  const wikiLog = data?.wikiLog || [];
  const anthropicNews = data?.anthropicNews || null;

  const notes = data?.notes || [];
  const daily = data?.daily || null;
  const agenda = data?.agenda || null;
  const today = data?.today || new Date().toISOString().slice(0, 10);
  const hasNoVaultContent = Boolean(data) && notes.length === 0 && !daily && wikiPages.length === 0 && Object.keys(data.people || {}).length === 0;
  // The graph + brain context need a daily object even when the vault has none.
  const dailyForEngine = daily || {
    id: "daily-none", kind: "daily", source: "obsidian", title: "Today", date: today,
    tasks: [], tags: ["daily"], person: OWNER_NAME, importance: "personal", body: "",
    pinned: false, done: false, archived: false, starred: false,
  };

  const goHome = () => { setPage("home"); setPagePerson(null); setPageChannel(null); };
  const goWiki = () => { setPage("wiki"); setPagePerson(null); setPageChannel(null); };
  const goMeetings = () => { setPage("meetings"); setPagePerson(null); setPageChannel(null); };
  const goPeople = (name) => { setPage("people"); setPagePerson(name || null); setPageChannel(null); };
  const goChannels = () => { setPage("channels"); setPageChannel(null); setPagePerson(null); };
  const goGraph = () => { setPage("graph"); setPagePerson(null); setPageChannel(null); };
  const goAnthropic = () => { setPage("anthropic"); setPagePerson(null); setPageChannel(null); };

  // Read-only: edits happen in the vault via Claude Code, then flow back through SSE.
  const noop = () => {};

  const allNotes = [dailyForEngine, ...notes];
  const noteById = (id) => allNotes.find((n) => n.id === id) || null;
  const reader = readerId ? noteById(readerId) : null;
  // Resolve a clicked reference ([[wikilink]] title or bare RFD-<n>) to a note
  // and open it in the reader. Unresolved refs are a no-op.
  const openNoteByRef = (text) => {
    const hit = findNoteByRef(notes, text);
    if (hit) setReaderId(hit.id);
  };

  // Names flagged hidden via their profile file. Hidden people drop out of the
  // People grid + header cluster and surface in the People page's Hidden section.
  const hiddenNames = React.useMemo(() => {
    const ppl = data?.people || {};
    return new Set(Object.keys(ppl).filter((name) => ppl[name]?.hidden));
  }, [data]);

  const people = React.useMemo(() => {
    const c = {};
    notes.filter((n) => !n.archived && !hiddenNames.has(n.person)).forEach((n) => c[n.person] = (c[n.person] || 0) + 1);
    return Object.keys(c).map((name) => ({ name, count: c[name] }))
      .sort((a, b) => isOwnerName(a.name) ? -1 : isOwnerName(b.name) ? 1 : b.count - a.count);
  }, [notes, hiddenNames]);

  // Full directory: note authors + everyone with a person file (the roster),
  // minus anyone hidden. The People page lists these; the home cluster stays
  // note-based. `hiddenDirectory` is the inverse — what the Hidden section shows.
  const buildDirectory = (includeHidden) => {
    const counts = {};
    notes.filter((n) => !n.archived).forEach((n) => { counts[n.person] = (counts[n.person] || 0) + 1; });
    const names = new Set([...Object.keys(counts), ...Object.keys(data?.people || {})]);
    return [...names]
      .filter((name) => (includeHidden ? hiddenNames.has(name) : !hiddenNames.has(name)))
      .map((name) => ({ name, count: counts[name] || 0 }))
      .sort((a, b) => (isOwnerName(a.name) ? -1 : isOwnerName(b.name) ? 1 : (b.count - a.count) || a.name.localeCompare(b.name)));
  };
  const directory = React.useMemo(() => buildDirectory(false), [notes, data, hiddenNames]);
  const hiddenDirectory = React.useMemo(() => buildDirectory(true), [notes, data, hiddenNames]);

  const started = messages.length > 0;

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const ask = async (text) => {
    const q = (text || "").trim();
    if (!q || busy) return;
    setInput("");
    const next = [...messages, { role: "user", text: q }];
    setMessages(next);
    setBusy(true);
    try {
      const ctx = brainContext(notes, dailyForEngine, { tasks: agenda?.tasks || [] });
      const convo = [
        { role: "user", content: ctx },
        { role: "assistant", content: "Got it. Ask anything about the workspace notes." },
        ...next.map((m) => ({ role: m.role, content: m.text })),
      ];
      const reply = ((await complete({ messages: convo, allowLocalFallback: false })) || "").trim();
      const rel = relatedNotes(notes, q, reply).map((n) => n.id);
      setMessages((m) => [...m, { role: "assistant", text: reply || "No matching workspace notes found.", notes: rel }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching the workspace brain. Try again in a moment.", notes: [] }]);
    }
    setBusy(false);
  };

  const openBrowse = (person) => { setBrowsePerson(person || null); setBrowseView("all"); setBrowse(true); };
  const openArchive = () => { setBrowsePerson(null); setBrowseView("archived"); setBrowse(true); };
  const openStarred = () => { setBrowsePerson(null); setBrowseView("starred"); setBrowse(true); };

  // The one in-UI mutation: flip a note's `archived` flag in the vault, then
  // refresh. The chokidar→SSE loop also refreshes; reload makes it feel instant.
  const archiveNote = async (id, archived) => {
    try {
      await setNoteArchived(id, archived);
      await reload();
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Mark a note read/unread in the vault; the card + reader title render struck
  // through. Same persist-then-refresh pattern as archive.
  const markRead = async (id, read) => {
    try {
      await setNoteRead(id, read);
      await reload();
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Star/unstar a note in the vault so the Starred drawer is stable across refreshes.
  const starNote = async (id, starred) => {
    try {
      await setNoteStarred(id, starred);
      await reload();
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Hide/show a person in the People list (writes `hidden` to their profile).
  // Same persist-then-refresh pattern as the note mutations.
  const hidePerson = async (name, hidden) => {
    try {
      await setPersonHidden(name, hidden);
      await reload();
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Daily-note tasks are stored in the daily markdown frontmatter, so toggles
  // persist through the vault backend instead of local component state.
  const toggleDailyTaskInVault = async (id, index, done) => {
    try {
      await toggleDailyTask(id, index, done);
      await reload();
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Compounding: file an assistant answer back into the vault as a real note so
  // explorations don't vanish into chat. Persists via the backend; SSE refreshes.
  const saveAnswer = async (text, q) => {
    const title = (q || text).replace(/\n/g, " ").trim().slice(0, 60);
    try {
      await saveNoteToVault({
        title,
        body: (q ? "## " + q + "\n\n" : "") + text,
        tags: ["synthesis"],
        person: OWNER_NAME,
        importance: "personal",
      });
      await reload();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (e) { /* surfaced via the banner if the backend is down */ }
  };

  // Persist an Ingest proposal into the vault wiki: create new pages, append the
  // change line to updated pages, log the ingest. Then refresh from the vault.
  const applyIngestToVault = async (proposal, srcTitle) => {
    const stamp = today;
    for (const c of proposal.creates || []) {
      await saveWikiPage({ title: c.title, type: c.type === "entity" ? "entity" : "concept", body: c.body || "", links: proposal.links || [], updated: stamp });
    }
    for (const u of proposal.updates || []) {
      const existing = wikiPages.find((p) => p.title.toLowerCase() === u.title.toLowerCase());
      const body = (existing ? existing.body : "") + `\n\n> Added ${stamp}: ${u.change}`;
      await saveWikiPage({ title: u.title, type: existing ? existing.type : "concept", body, links: existing ? existing.links : [], sources: existing ? existing.sources : [], updated: stamp });
    }
    const touched = [...(proposal.creates || []).map((c) => c.title), ...(proposal.updates || []).map((u) => u.title)];
    await appendLog({ kind: "ingest", text: `${srcTitle || "Source"} → ${touched.map((t) => "[[" + t + "]]").join(", ") || "no changes"}` });
    await reload();
  };

  const logToVault = async (entry) => { await appendLog(entry); await reload(); };

  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); }
      else if (e.key === "Escape") { setPalette(false); setReaderId(null); setBrowse(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const dateLong = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ---- connection states ----
  const banner = error
    ? <div className="vault-banner err">Can't reach the vault backend. Start it with <code>npm run dev</code> in <code>server/</code>. <button onClick={reload} type="button">Retry</button></div>
    : null;

  return (
    <TooltipProvider>
    <div className={"brain" + (t.dark ? " dark" : "")} style={{ "--accent": t.accent }}>
      <header className="bhead">
        <div className="bhead-left">
          <button className="bhead-id" onClick={goHome} type="button">
            <BrainMark size={30} />
            <span className="bhead-name">Second brain</span>
          </button>
          <nav className="bnav">
            <button className={"bnav-tab" + (page === "home" ? " on" : "")} onClick={goHome} type="button">Brain</button>
            <button className={"bnav-tab" + (page === "wiki" ? " on" : "")} onClick={goWiki} type="button">Wiki</button>
            <button className={"bnav-tab" + (page === "meetings" ? " on" : "")} onClick={goMeetings} type="button">Meetings</button>
            <button className={"bnav-tab" + (page === "people" ? " on" : "")} onClick={() => goPeople(null)} type="button">People</button>
            <button className={"bnav-tab" + (page === "channels" ? " on" : "")} onClick={goChannels} type="button">Channels</button>
            <button className={"bnav-tab" + (page === "graph" ? " on" : "")} onClick={goGraph} type="button">Graph</button>
            <button className={"bnav-tab" + (page === "anthropic" ? " on" : "")} onClick={goAnthropic} type="button">Anthropic</button>
          </nav>
        </div>
        <div className="bhead-actions">
          <PeopleCluster people={people} onPick={(name) => goPeople(name)} />
          <span className={"live-chip " + (error ? "err" : loading ? "sync" : "ok")} title={error ? "Vault backend is unreachable" : loading ? "Reading vault state" : "Vault refresh is connected"}>
            <span className="live-dot" />
            <span className="live-text">{error ? "Offline" : loading ? "Syncing" : "Live"}</span>
          </span>
          {started && page === "home" ? <button className="bhead-btn ghost" onClick={() => setMessages([])} type="button">New</button> : null}
          <button className="bhead-btn ghost icon" onClick={openStarred} type="button" aria-label="Starred notes"><Icon name="star" size={16} /></button>
          <button className="bhead-btn ghost icon" onClick={openArchive} type="button" aria-label="Archive"><Icon name="archive" size={16} /></button>
          <button className="bhead-btn ghost icon" onClick={() => window.dispatchEvent(new Event("twk:toggle"))} type="button" aria-label="Settings"><Icon name="settings" size={16} /></button>
          <button className="bhead-btn icon" onClick={() => setPalette(true)} type="button" aria-label="Command"><Icon name="search" size={16} /><kbd>⌘K</kbd></button>
        </div>
      </header>

      {banner}

      <main className="bmain">
        {loading && !data ? (
          <div className="vault-loading">Reading workspace vault…</div>
        ) : hasNoVaultContent ? (
          <FirstRunEmptyState onRetry={reload} />
        ) : page === "graph" ? (
          <GraphView notes={notes} daily={dailyForEngine} people={people} readOnly={READ_ONLY}
            canArchive={ARCHIVE_ENABLED} onPin={noop} onArchive={archiveNote} onToggleDone={noop}
            onToggleTask={noop} onSetImportance={noop} />
        ) : (
          <>
            <div className="bscroll" ref={scrollRef}>
              {page === "meetings" ?
                  <ZoomPage meetings={zoomMeetings} onToggleTodo={async (id, i, done) => { try { await toggleZoomTodo(id, i, done); await reload(); } catch (e) { /* surfaced via banner */ } }} /> :
                page === "wiki" ?
                  <WikiPage pages={wikiPages} log={wikiLog} onApply={applyIngestToVault} onLog={logToVault}
                    notes={notes} onOpenNote={(id) => setReaderId(id)} /> :
                page === "people" ?
                  <PeoplePage people={directory} hiddenPeople={hiddenDirectory} notes={notes} pagePerson={pagePerson}
                    onPickPerson={(name) => setPagePerson(name)} onBack={() => setPagePerson(null)}
                    onOpenNote={(x) => setReaderId(x.id)} onHidePerson={hidePerson}
                    canHide={ARCHIVE_ENABLED} /> :
                  page === "channels" ?
                    <ChannelsPage notes={notes} pageChannel={pageChannel}
                      onPickChannel={(c) => setPageChannel(c)} onBack={() => setPageChannel(null)}
                      onOpenNote={(x) => setReaderId(x.id)} /> :
                  page === "anthropic" ?
                    <AnthropicNewsPage news={anthropicNews} /> :
                    !started ?
                      <HomeCommandCenter
                        daily={daily}
                        dateLong={dateLong}
                        essence={personaEssence(notes, people)}
                        greeting={timeGreeting()}
                        loading={loading}
                        meetings={zoomMeetings}
                        notes={notes}
                        onAsk={ask}
                        onGoMeetings={goMeetings}
                        onGoWiki={goWiki}
                        onOpenNote={(x) => setReaderId(x.id)}
                        onToggleDailyTask={toggleDailyTaskInVault}
                        suggestions={BRAIN_SUGGEST}
                        today={today}
                      /> :

                      <div className="thread">
                        <button className="page-back thread-back" onClick={() => setMessages([])} type="button">
                          <Icon name="chevronRight" size={14} stroke={2.4} />
                          Back to questions
                        </button>
                        {messages.map((m, i) =>
                          m.role === "user" ?
                            <div className="ex-q" key={i}><div className="ex-qtext">{m.text}</div></div> :
                            <div className="ex-a" key={i}>
                              <BrainMark size={28} />
                              <div className="ex-body">
                                <div className="ex-text">{brainReply(m.text)}</div>
                                {m.notes && m.notes.length ?
                                  <div className="ex-notes">
                                    <div className="ex-notes-label">From workspace notes</div>
                                    {m.notes.map((id) => { const n = noteById(id); return n ? <NoteCard key={id} note={n} onOpen={(x) => setReaderId(x.id)} compact /> : null; })}
                                  </div> :
                                  null}
                                <button className="save-answer" onClick={() => saveAnswer(m.text, messages[i - 1] && messages[i - 1].role === "user" ? messages[i - 1].text : null)} type="button">
                                  <Icon name="vault" size={13} /> Save as note
                                </button>
                              </div>
                            </div>
                        )}
                        {busy ?
                          <div className="ex-a"><BrainMark size={28} /><div className="ex-body"><div className="typing"><span></span><span></span><span></span></div></div></div> :
                          null}
                      </div>
              }
            </div>

            {page === "home" ?
              <form className="binput" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the workspace brain anything…" />
                <button className="bsend" type="submit" disabled={busy || !input.trim()} aria-label="Send"><Icon name="chevronRight" size={20} stroke={2.4} /></button>
              </form> :
              null}
          </>
        )}
      </main>

      {reader ? <Reader note={reader} readOnly={READ_ONLY} canArchive={ARCHIVE_ENABLED} canStar={!reader.kind} canToggleTasks={reader.kind === "daily"} onMarkRead={markRead} onStar={starNote} onClose={() => setReaderId(null)} onPin={noop} onArchive={archiveNote} onToggleDone={noop} onToggleTask={(id, i) => toggleDailyTaskInVault(id, i, !((noteById(id)?.tasks || [])[i]?.done))} onSetImportance={noop} onWikiLink={openNoteByRef} /> : null}
      {browse ? <BrowsePanel notes={notes} people={people} initialPerson={browsePerson} initialView={browseView} onOpen={(x) => { setReaderId(x.id); setBrowse(false); }} onClose={() => setBrowse(false)} /> : null}
      {palette ? <Palette notes={notes} people={people} onClose={() => setPalette(false)} actions={{ ask, browse: () => openBrowse(null), browsePerson: openBrowse, openNote: (id) => setReaderId(id) }} /> : null}
      {savedFlash ? <div className="saved-flash"><Icon name="check" size={15} stroke={3} /> Saved to workspace notes</div> : null}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakColor label="Accent" value={t.accent} options={["#7A45FF", "#00C5AB", "#FFA900", "#FF57AC", "#005CE5"]} onChange={(v) => setTweak("accent", v)} />
      </TweaksPanel>
    </div>
    </TooltipProvider>
  );
}
