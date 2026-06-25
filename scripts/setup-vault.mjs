import fs from "node:fs";
import path from "node:path";
import {
  copyDirectory,
  isConfiguredVaultPath,
  readServerEnv,
  scopeRoot,
  SCOPE_FOLDER,
  SERVER_ENV_PATH,
  VAULT_TEMPLATE_DIR,
} from "./lib/setup-utils.mjs";

const env = await readServerEnv();

if (!env) {
  console.error(`Missing ${SERVER_ENV_PATH}. Run npm run setup first.`);
  process.exit(1);
}

if (!isConfiguredVaultPath(env.VAULT_PATH)) {
  console.error("VAULT_PATH is not configured. Set VAULT_PATH=/absolute/path/to/Obsidian Vault in server/.env.");
  process.exit(1);
}

if (!fs.existsSync(env.VAULT_PATH)) {
  console.error(`VAULT_PATH does not exist: ${env.VAULT_PATH}`);
  process.exit(1);
}

await copyDirectory(path.join(VAULT_TEMPLATE_DIR, SCOPE_FOLDER), scopeRoot(env.VAULT_PATH));

console.log(`Scaffolded ${path.relative(env.VAULT_PATH, scopeRoot(env.VAULT_PATH)) || "Second Brain"} in ${env.VAULT_PATH}`);
console.log("Existing files were left unchanged.");
