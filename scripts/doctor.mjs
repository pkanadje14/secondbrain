import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  executableWorks,
  isConfiguredVaultPath,
  pathExists,
  readServerEnv,
  REPO_ROOT,
  scopeRoot,
  SERVER_DIR,
  SERVER_ENV_PATH,
} from "./lib/setup-utils.mjs";

const checks = [];

function pass(label, detail = "") {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail = "") {
  checks.push({ ok: false, label, detail });
}

async function checkPath(label, target, remediation) {
  if (await pathExists(target)) pass(label, target);
  else fail(label, remediation);
}

await checkPath("Root dependencies", path.join(REPO_ROOT, "node_modules"), "Run npm install");
await checkPath("Backend dependencies", path.join(SERVER_DIR, "node_modules"), "Run cd server && npm install");

const env = await readServerEnv();
if (!env) {
  fail("Backend env", `Missing ${SERVER_ENV_PATH}. Run npm run setup`);
} else {
  pass("Backend env", SERVER_ENV_PATH);
}

let port = "8787";
let vaultPath = "";

if (env) {
  vaultPath = env.VAULT_PATH || "";
  port = env.PORT || port;

  if (isConfiguredVaultPath(vaultPath)) {
    pass("VAULT_PATH configured", vaultPath);
    if (fs.existsSync(vaultPath)) {
      pass("Vault root exists", vaultPath);
      const root = scopeRoot(vaultPath);
      if (fs.existsSync(root)) {
        pass("Second Brain surface exists", root);
      } else {
        fail("Second Brain surface exists", "Run npm run setup:vault");
      }
    } else {
      fail("Vault root exists", `Create the vault folder or update VAULT_PATH: ${vaultPath}`);
    }
  } else {
    fail("VAULT_PATH configured", "Set VAULT_PATH=/absolute/path/to/Obsidian Vault in server/.env");
  }

  const claudeBin = env.CLAUDE_BIN || env.HMG_CLAUDE_BIN || "/opt/homebrew/bin/claude";
  if (await executableWorks(claudeBin)) {
    pass("Claude CLI", claudeBin);
  } else {
    fail("Claude CLI", "Set CLAUDE_BIN in server/.env if backend AI calls should use Claude CLI");
  }
}

try {
  const controller = new AbortController();
  const timeout = delay(1500).then(() => controller.abort());
  const response = await Promise.race([
    fetch(`http://localhost:${port}/api/health`, { signal: controller.signal }),
    timeout,
  ]);
  if (response?.ok) {
    const health = await response.json();
    pass("Backend health", `http://localhost:${port}/api/health exists=${Boolean(health.exists)}`);
  } else {
    fail("Backend health", `Start with npm run dev:all or cd server && npm run dev`);
  }
} catch {
  fail("Backend health", `Start with npm run dev:all or cd server && npm run dev`);
}

console.log("Second Brain doctor");
console.log("");

let failed = 0;
for (const check of checks) {
  const marker = check.ok ? "ok" : "fail";
  console.log(`${marker.padEnd(4)} ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
  if (!check.ok) failed += 1;
}

console.log("");
if (failed > 0) {
  console.log(`${failed} check${failed === 1 ? "" : "s"} need attention.`);
  process.exitCode = 1;
} else {
  console.log("All checks passed.");
}
