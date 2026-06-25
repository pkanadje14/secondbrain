// graph.js — turn notes + people + tags into the Neo4j-shaped { nodes, links }
// payload the force sim expects. Pure, no React.

import { personOf } from "./registry.js";

// readable labels for tag-derived concept nodes
const CONCEPT_LABEL = {
  experiment: "Experiments", lifecycle: "Lifecycle", points: "Points",
  eng: "Engineering", performance: "Performance", design: "Design",
  home: "Home tile", data: "Data", funnel: "Funnel", "1on1": "1:1s",
  management: "Management", idea: "Ideas", growth: "Growth", reading: "Reading",
  incident: "Incidents", brand: "Brand", copy: "Copy", roadmap: "Roadmap",
  planning: "Planning", daily: "Daily", onboarding: "Onboarding", standup: "Standup",
};

export function conceptLabel(tag) {
  return CONCEPT_LABEL[tag] || (tag.charAt(0).toUpperCase() + tag.slice(1));
}

// Fetch palette by node type
export const GRAPH_NODE_COLOR = {
  obsidian: "var(--accent)",
  slack: "var(--fetch-teal-50)",
  concept: "var(--fetch-orange-50)",
};

export function buildGraph(notes, daily, people) {
  const live = [daily, ...notes.filter((n) => !n.archived)];
  const nodes = [];
  const links = [];
  const byId = {};
  const add = (node) => { nodes.push(node); byId[node.id] = node; return node; };

  // --- person nodes (hubs) ---
  const personCount = {};
  live.forEach((n) => (personCount[n.person] = (personCount[n.person] || 0) + 1));
  Object.keys(personCount).forEach((name) => {
    const p = personOf(name);
    add({
      id: "person:" + name, type: "person", label: name,
      color: p.color, r: 16 + Math.min(10, personCount[name] * 1.6),
      meta: { name, role: (p.role || ""), count: personCount[name] },
    });
  });

  // --- concept nodes (from tags), only tags used >= 2x stay as hubs ---
  const tagCount = {};
  live.forEach((n) => (n.tags || []).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
  Object.keys(tagCount).forEach((t) => {
    add({
      id: "concept:" + t, type: "concept", label: conceptLabel(t),
      color: GRAPH_NODE_COLOR.concept, r: 9 + Math.min(13, tagCount[t] * 2.5),
      meta: { tag: t, count: tagCount[t] },
    });
  });

  // --- note nodes + their edges ---
  live.forEach((n) => {
    const isDaily = n.kind === "daily";
    add({
      id: "note:" + n.id, type: "note", source: n.source, label: n.title,
      color: GRAPH_NODE_COLOR[n.source] || GRAPH_NODE_COLOR.obsidian,
      r: isDaily ? 14 : (n.importance === "project" ? 11 : 9),
      noteId: n.id, importance: n.importance || null, daily: isDaily,
    });
    // note -> person  (WROTE / FROM)
    if (byId["person:" + n.person]) {
      links.push({ source: "note:" + n.id, target: "person:" + n.person, kind: n.source === "slack" ? "from" : "wrote" });
    }
    // note -> concept  (MENTIONS)
    (n.tags || []).forEach((t) => {
      if (byId["concept:" + t]) links.push({ source: "note:" + n.id, target: "concept:" + t, kind: "mentions" });
    });
  });

  // adjacency for highlight-on-select
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = new Set()));
  links.forEach((l) => { adj[l.source].add(l.target); adj[l.target].add(l.source); });

  return { nodes, links, byId, adj };
}

// which graph node ids correspond to a set of note ids (+ their people & concepts)
export function nodesForNotes(graph, noteIds, notesData) {
  const set = new Set();
  noteIds.forEach((id) => {
    set.add("note:" + id);
    const note = notesData.find((n) => n.id === id);
    if (!note) return;
    if (graph.byId["person:" + note.person]) set.add("person:" + note.person);
    (note.tags || []).forEach((t) => { if (graph.byId["concept:" + t]) set.add("concept:" + t); });
  });
  return set;
}
