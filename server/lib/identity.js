export const OWNER_NAME = "Owner";

const LEGACY_OWNER_NAMES = new Set(["You"]);

export function normalizePersonName(value, fallback = OWNER_NAME) {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return LEGACY_OWNER_NAMES.has(name) ? OWNER_NAME : name;
}

export function normalizePersonList(value) {
  if (Array.isArray(value)) return value.map((name) => normalizePersonName(name));
  if (value === undefined || value === null) return [];
  return [normalizePersonName(value)];
}
