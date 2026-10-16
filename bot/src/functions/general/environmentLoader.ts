import { copyFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../");
const botDir = resolve(__dirname, "../../../");
const sharedDir = resolve(repoRoot, "shared");

let environmentLoaded = false;

function loadEnvFile(filePath: string, override = true): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  const result = dotenv.config({ path: filePath, override });
  if (result.parsed) {
    dotenvExpand.expand({ parsed: result.parsed });
    console.log(`Loaded environment file ${filePath}`);
    return true;
  }

  if (result.error) {
    console.warn(`Could not parse ${filePath}: ${result.error.message}`);
  }
  return false;
}

function ensureRootEnvFile(): void {
  const rootEnv = resolve(repoRoot, ".env");
  const example = resolve(repoRoot, "env.example");
  if (existsSync(rootEnv) || !existsSync(example)) {
    return;
  }

  copyFileSync(example, rootEnv);
  console.warn(`Created ${rootEnv} from env.example. Fill in DISCORD_TOKEN to log the bot into Discord.`);
}

/**
 * Load environment files from the Bubbles repo root, shared package, and bot directory.
 * Called on import so ESM import hoisting cannot start the client before env exists.
 */
export function loadEnvironment(): void {
  if (environmentLoaded) {
    return;
  }

  try {
    ensureRootEnvFile();

    const nodeEnv = process.env.NODE_ENV ?? "development";
    // Later files override earlier ones. Shared defaults first, then repo root, then bot.
    const files = [
      resolve(sharedDir, ".env"),
      resolve(repoRoot, ".env"),
      resolve(repoRoot, `.env.${nodeEnv}`),
      resolve(botDir, ".env"),
      resolve(botDir, `.env.${nodeEnv}`),
      resolve(process.cwd(), ".env"),
    ];

    let loaded = 0;
    for (const file of files) {
      if (loadEnvFile(file, true)) {
        loaded += 1;
      }
    }

    environmentLoaded = true;
    if (loaded === 0) {
      console.warn(
        `No .env file found. Looked in ${repoRoot}, ${sharedDir}, ${botDir}, and ${process.cwd()}. Copy env.example to .env.`
      );
    }
    console.log(`Environment loading complete. NODE_ENV=${process.env.NODE_ENV ?? "development"}`);
  } catch (error) {
    console.error("Failed to load environment variables:", error);
  }
}

export function isEnvironmentLoaded(): boolean {
  return environmentLoaded;
}

loadEnvironment();
