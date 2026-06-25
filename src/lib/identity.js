export const OWNER_NAME = "Owner";

const LEGACY_OWNER_NAMES = new Set(["You"]);

export function normalizePersonName(value, fallback = OWNER_NAME) {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return LEGACY_OWNER_NAMES.has(name) ? OWNER_NAME : name;
}

export function isOwnerName(value) {
  return normalizePersonName(value) === OWNER_NAME;
}
