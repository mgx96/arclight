// One-time Circle entity-secret setup for the creator's Programmable Wallet (Developer-Controlled).
//
// Developer-Controlled Wallets need TWO Circle Console credentials:
//   - CIRCLE_API_KEY        the key you generate in the Circle Developer Console (Testnet scope)
//   - CIRCLE_ENTITY_SECRET  a 32-byte secret you generate here, then register with Circle
//
//   pnpm circle:gen        # print a fresh entity secret — paste it into .env.local yourself
//   pnpm circle:register   # register that secret's ciphertext with Circle, save the recovery file
//
// The entity secret and recovery file are YOURS — they never get committed. We only script this on
// testnet for convenience; on mainnet you'd generate and register it by hand.
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import os from "node:os";
import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
} from "@circle-fin/developer-controlled-wallets";

const here = dirname(fileURLToPath(import.meta.url));
const envLocal = resolve(here, "..", ".env.local");
if (existsSync(envLocal)) loadEnv({ path: envLocal, override: true });

const cmd = process.argv[2];

if (cmd === "gen") {
  console.log("\nGenerating a fresh Circle entity secret (32-byte hex)…\n");
  // Prints the secret to stdout. Copy it into .env.local as CIRCLE_ENTITY_SECRET, then run register.
  generateEntitySecret();
  console.log(
    "\nNext:\n" +
      "  1. Copy the entity secret above into app/backend/.env.local as:\n" +
      "       CIRCLE_ENTITY_SECRET=<the value>\n" +
      "  2. Make sure CIRCLE_API_KEY is also set in .env.local.\n" +
      "  3. Run: pnpm circle:register\n"
  );
  process.exit(0);
}

if (cmd === "register") {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim();
  if (!apiKey) {
    console.error("CIRCLE_API_KEY is missing from .env.local. Add it (Circle Console → API & Client Keys), then retry.");
    process.exit(1);
  }
  if (!entitySecret) {
    console.error("CIRCLE_ENTITY_SECRET is missing from .env.local. Run `pnpm circle:gen` first, paste the value in, then retry.");
    process.exit(1);
  }

  // The SDK writes the recovery file INTO this directory (it picks the filename) and validates that
  // the path is an existing directory before calling Circle — so pass the dir, not a file path.
  const dir = join(os.homedir(), ".circle");
  mkdirSync(dir, { recursive: true });

  console.log("\nRegistering entity-secret ciphertext with Circle…");
  const response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: dir,
  });
  console.log("Registered ✓");
  console.log(`Recovery file written under: ${dir}`);
  console.log("Keep that file safe — it's how you'd rotate/recover the entity secret. Do NOT commit it.\n");
  if (response.data?.recoveryFile) {
    console.log("(A copy of the recovery file contents was also returned by the API.)");
  }
  process.exit(0);
}

console.error("Usage: pnpm circle:gen   |   pnpm circle:register");
process.exit(1);
