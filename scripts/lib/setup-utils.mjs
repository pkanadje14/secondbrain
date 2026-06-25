import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const SERVER_DIR = path.join(REPO_ROOT, "server");
export const SERVER_ENV_PATH = path.join(SERVER_DIR, ".env");
export const SERVER_ENV_EXAMPLE_PATH = path.join(SERVER_DIR, ".env.example");
export const VAULT_TEMPLATE_DIR = path.join(REPO_ROOT, "templates", "vault");
export const SCOPE_FOLDER = "Second Brain";

const PLACEHOLDER_VAULT_PATHS = new Set([
  "",
  "/absolute/path/to/Obsidian Vault",
]);

export function parseEnv(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export async function readServerEnv() {
  try {
    return parseEnv(await fsp.readFile(SERVER_ENV_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function ensureServerEnv() {
  if (fs.existsSync(SERVER_ENV_PATH)) {
    return { created: false, path: SERVER_ENV_PATH };
  }
  await fsp.copyFile(SERVER_ENV_EXAMPLE_PATH, SERVER_ENV_PATH);
  return { created: true, path: SERVER_ENV_PATH };
}

export function isConfiguredVaultPath(value) {
  return Boolean(value) && !PLACEHOLDER_VAULT_PATHS.has(String(value).trim());
}

export function scopeRoot(vaultPath) {
  return path.join(vaultPath, SCOPE_FOLDER);
}

export async function copyDirectory(source, target) {
  const entries = await fsp.readdir(source, { withFileTypes: true });
  await fsp.mkdir(target, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (!fs.existsSync(targetPath)) {
      await fsp.copyFile(sourcePath, targetPath);
    }
  }
}

export async function pathExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function commandExists(command) {
  const pathValue = process.env.PATH || "";
  const extensions = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      try {
        await fsp.access(candidate, fs.constants.X_OK);
        return true;
      } catch {
        // Keep searching PATH.
      }
    }
  }
  return false;
}

export async function executableWorks(command) {
  if (!command) return false;
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return pathExists(command);
  }
  return commandExists(command);
}

export function printNextSteps() {
  console.log("");
  console.log("Next steps:");
  console.log("  1. Set VAULT_PATH=/absolute/path/to/Obsidian Vault in server/.env");
  console.log("  2. Run npm run setup:vault");
  console.log("  3. Run npm run dev:all");
  console.log("  4. Open http://localhost:5173");
}
