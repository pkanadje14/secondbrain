// shared.jsx — icons, helpers, avatars, source badge, and the markdown renderer.
// The pieces every page and drawer reuses. Ported from the prototype's shared.jsx
// (window globals → named ES exports). DetailPanel / PeopleStrip / TagChip from the
// original lived only in the Notes Hub prototype and are intentionally omitted here.

import { personOf, getToday } from "../lib/registry.js";

export { personOf };

/* ----------------------------------------------------------------- icons */
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".75" fill="currentColor"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  vault: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 7v10"/><path d="m8.5 9.5 7 5"/><path d="m15.5 9.5-7 5"/>',
  hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  sparkle: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
};

export function Icon({ name, size = 20, stroke = 2, style, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }}
    />
  );
}

/* --------------------------------------------------------------- helpers */
export function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date(getToday() + "T00:00:00");
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return diff + " days ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ----------------------------------------------------------- people */
/* personOf is re-exported from registry.js (vault-backed, with fallback). */

export function Avatar({ name, size = 24 }) {
  const p = personOf(name);
  return (
    <span className="avatar" style={{ width: size, height: size, background: p.color, fontSize: Math.round(size * 0.4) }}>
      {p.initials}
    </span>
  );
}

export const SOURCE_META = {
  obsidian: { label: "Obsidian", icon: "vault", color: "var(--accent)" },
  slack: { label: "Slack", icon: "hash", color: "var(--fetch-teal-60)" },
  atlassian: { label: "Atlassian", icon: "link", color: "var(--fetch-blue-70)" },
  jira: { label: "Jira", icon: "ticket", color: "var(--fetch-blue-70)" },
  confluence: { label: "Confluence", icon: "file", color: "var(--fetch-blue-60)" },
  rfd: { label: "RFD", icon: "file", color: "var(--fetch-purple-70)" },
};

// Any source carrying a permalink works; unknown sources degrade gracefully
// to a titlecased label + generic link icon instead of crashing on lookup.
export function sourceMeta(source) {
  if (source && SOURCE_META[source]) return SOURCE_META[source];
  const label = source ? source.charAt(0).toUpperCase() + source.slice(1) : "Note";
  return { label, icon: "link", color: "var(--fetch-text-secondary)" };
}

export function SourceBadge({ source, channel, compact }) {
  const m = sourceMeta(source);
  return (
    <span className="src-badge" style={{ color: m.color }}>
      <Icon name={m.icon} size={compact ? 13 : 14} stroke={2.2} />
      <span>{source === "slack" && channel ? channel : m.label}</span>
    </span>
  );
}

/* Inline markup for one line of text. Recognizes (in priority order):
 * [[wikilink]], [text](url), **bold**, bare URL, and bare RFD-<n> refs.
 * Wikilinks + RFD refs render as href-less .md-wiki anchors resolved in-app by
 * the NoteBody/container click delegation; external links are real anchors. */
export function renderInline(txt) {
  const parts = String(txt).split(/(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s)]+|\bRFD-\d+\b)/g);
  return parts.map((p, i) => {
    if (/^\[\[[^\]]+\]\]$/.test(p)) return <a className="md-wiki" key={i}>{p.slice(2, -2)}</a>;
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a className="md-link" key={i} href={link[2]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{link[1]}</a>;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^https?:\/\/[^\s)]+$/.test(p)) return <a className="md-link" key={i} href={p} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{p}</a>;
    if (/^RFD-\d+$/.test(p)) return <a className="md-wiki" key={i}>{p}</a>;
    return p;
  });
}

/* Resolve a clicked reference (wikilink title or bare RFD-<n>) to a note.
 * Exact title match first; then, for RFD-<n>, any note whose title or id carries
 * that RFD number. Returns the note or null (callers no-op on null). */
export function findNoteByRef(notes, text) {
  const raw = String(text ?? "").trim();
  const exact = raw.toLowerCase();
  const byTitle = (notes || []).find((n) => (n.title || "").trim().toLowerCase() === exact);
  if (byTitle) return byTitle;
  const rfd = raw.match(/^RFD-(\d+)$/i);
  if (rfd) {
    const re = new RegExp(`\\bRFD-?${rfd[1]}\\b`, "i");
    return (notes || []).find((n) => re.test(n.title || "") || re.test(n.id || "")) || null;
  }
  return null;
}

/* render a tiny subset of markdown (headings, bullets, checkboxes, bold, [[links]]) */
export function renderBody(body) {
  const lines = body.split("\n");
  const out = [];
  let list = [];
  const flush = (key) => {
    if (list.length) {
      out.push(<ul className="md-ul" key={"ul" + key}>{list}</ul>);
      list = [];
    }
  };
  const inline = renderInline;
  lines.forEach((ln, i) => {
    if (ln.startsWith("## ")) { flush(i); out.push(<h4 className="md-h" key={i}>{ln.slice(3)}</h4>); }
    else if (/^- \[[ x]\] /.test(ln)) {
      const checked = ln[3] === "x";
      list.push(<li className={"md-task" + (checked ? " done" : "")} key={i}><span className="md-box">{checked ? <Icon name="check" size={12} stroke={3} /> : null}</span>{inline(ln.slice(6))}</li>);
    }
    else if (ln.startsWith("- ")) list.push(<li key={i}>{inline(ln.slice(2))}</li>);
    else if (ln.trim() === "") { flush(i); }
    else { flush(i); out.push(<p className="md-p" key={i}>{inline(ln)}</p>); }
  });
  flush("end");
  return out;
}

/* Body wrapper that makes [[wikilinks]] clickable via event delegation (the
 * inline renderer leaves them href-less). External [text](url) / bare URLs are
 * real anchors and need no handler. Mirrors WikiPage's WikiBody pattern. */
export function NoteBody({ body, onWikiLink, className }) {
  const handleClick = (e) => {
    if (onWikiLink && e.target.classList.contains("md-wiki")) {
      e.stopPropagation();
      onWikiLink(e.target.textContent);
    }
  };
  return <div className={className} onClick={handleClick}>{renderBody(body)}</div>;
}

/* ----------------------------------------------------------- brain mark */
export function BrainMark({ size = 30 }) {
  return <span className="brain-mark" style={{ width: size, height: size }}><Icon name="sparkle" size={size * 0.56} stroke={2.2} /></span>;
}
