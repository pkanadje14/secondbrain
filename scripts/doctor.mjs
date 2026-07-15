import fs from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
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
const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = process.env.SECOND_BRAIN_CLAUDE_TOKEN_SERVICE || "second-brain-claude-code-oauth-token";
const KEYCHAIN_ACCOUNT = process.env.SECOND_BRAIN_CLAUDE_TOKEN_ACCOUNT || "refresh-all";
const SECURITY_BIN = process.env.SECOND_BRAIN_SECURITY_BIN || "/usr/bin/security";
const KEYCHAIN_TIMEOUT_MS = Number(process.env.SECOND_BRAIN_KEYCHAIN_TIMEOUT_MS) || 5_000;
const MCP_HEALTH_TIMEOUT_MS = Number(process.env.CLAUDE_MCP_HEALTH_TIMEOUT_MS) || 12_000;

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

async function checkClaudeAuth(claudeBin) {
  try {
    const { stdout } = await execFileAsync(claudeBin, ["auth", "status"]);
    const auth = JSON.parse(stdout);
    if (auth.loggedIn) {
      pass("Claude auth", auth.authMethod || "authenticated");
      return;
    }
  } catch {
    // Fall through to the shared failure below.
  }

  try {
    const { stdout } = await execFileAsync(
      SECURITY_BIN,
      ["find-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE, "-w"],
      { timeout: KEYCHAIN_TIMEOUT_MS }
    );
    if (stdout.trim()) {
      pass("Claude automation auth", `Keychain service ${KEYCHAIN_SERVICE}`);
      return;
    }
  } catch {
    // Fall through to the shared failure below.
  }

  fail("Claude auth", "Run `claude auth login` or `claude setup-token`, then store the token in macOS Keychain");
}

function connectorName(line) {
  const withoutStatus = line.replace(/\s+-\s+.*$/, "");
  return withoutStatus.split(": ")[0].trim();
}

async function checkClaudeMcpConnectors(claudeBin) {
  try {
    const { stdout } = await execFileAsync(claudeBin, ["mcp", "list"], {
      timeout: MCP_HEALTH_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    const failed = stdout
      .split(/\r?\n/)
      .filter((line) => line.includes("Failed to connect"))
      .map(connectorName)
      .filter(Boolean);

    if (failed.length > 0) {
      fail("Claude MCP connectors", `Failed: ${failed.join(", ")}`);
      return;
    }

    pass("Claude MCP connectors", "No failed connectors reported");
  } catch (err) {
    if (err.killed || err.signal === "SIGTERM") {
      fail("Claude MCP connectors", `Health check timed out after ${MCP_HEALTH_TIMEOUT_MS}ms`);
      return;
    }

    const output = [err.stdout, err.stderr, err.message]
      .filter((value) => typeof value === "string" && value.trim())
      .join("\n");
    const failed = output
      .split(/\r?\n/)
      .filter((line) => line.includes("Failed to connect"))
      .map(connectorName)
      .filter(Boolean);

    if (failed.length > 0) {
      fail("Claude MCP connectors", `Failed: ${failed.join(", ")}`);
    } else {
      fail("Claude MCP connectors", err.message);
    }
  }
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
    await checkClaudeAuth(claudeBin);
    await checkClaudeMcpConnectors(claudeBin);
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
