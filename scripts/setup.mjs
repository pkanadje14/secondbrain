import { ensureServerEnv, isConfiguredVaultPath, printNextSteps, readServerEnv, SERVER_ENV_PATH } from "./lib/setup-utils.mjs";

const result = await ensureServerEnv();

if (result.created) {
  console.log(`Created ${SERVER_ENV_PATH}`);
} else {
  console.log(`${SERVER_ENV_PATH} already exists`);
}

const env = await readServerEnv();
const vaultPath = env?.VAULT_PATH || "";

if (isConfiguredVaultPath(vaultPath)) {
  console.log(`VAULT_PATH is set to ${vaultPath}`);
  console.log("Run npm run setup:vault to scaffold the vault surface.");
} else {
  console.log("VAULT_PATH is not configured yet.");
  printNextSteps();
}
