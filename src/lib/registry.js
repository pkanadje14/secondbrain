// registry.js — runtime singletons fed by the vault backend.
//
// The prototype hardcoded notes/people/today in src/data/*.js and read them via
// static imports. With the vault as source of truth, those values arrive at
// runtime from the API. This module is the single place they live so the shared
// helpers (personOf, fmtDate), the local brain, and brainContext can stay pure
// imports without each fetching or threading props.

import { normalizePersonName } from "./identity.js";

let _today = new Date().toISOString().slice(0, 10);
let _people = {};            // name -> { name, initials, color, role }
let _notes = [];             // live note objects (excludes daily)
let _daily = null;           // live daily note object

export function setRegistry({ today, people, notes, daily } = {}) {
  if (today) _today = today;
  if (people) _people = people;
  if (notes) _notes = notes;
  if (daily !== undefined) _daily = daily;
}

export function getToday() { return _today; }
export function getNotes() { return _notes; }
export function getDaily() { return _daily; }

// Stable, readable fallback color for people without a profile page.
const FALLBACK_COLORS = ["#5B566C", "#2576E9", "#00A9A0", "#FF57AC", "#FFA900", "#7A45FF", "#0977D8", "#1C8744"];
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}
function deriveInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function personOf(name) {
  const normalizedName = normalizePersonName(name, "?");
  if (_people[normalizedName]) return _people[normalizedName];
  return { name: normalizedName, initials: deriveInitials(normalizedName), color: hashColor(normalizedName), role: "" };
}
