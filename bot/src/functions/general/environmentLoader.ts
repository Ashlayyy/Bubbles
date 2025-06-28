import dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

let environmentLoaded = false;

/**
 * Centralized environment variable loading with support for both local development and PM2
 * This should be called ONCE at the very start of the application before any other imports
 */
export function loadEnvironment(): void {
  if (environmentLoaded) {
    return; // Already loaded, don't load again
  }

  try {
    // Determine if we're running under PM2 or locally
    const isRunningUnderPM2 = process.env.PM2_HOME !== undefined || process.env.name?.startsWith("bubbles-") === true;

    if (isRunningUnderPM2) {
      // PM2 mode - use current working directory paths (PM2 handles this)
      console.log("🔧 Loading environment variables for PM2...");

      // Load root .env first
      const rootEnvPath = resolve(process.cwd(), ".env");
      if (existsSync(rootEnvPath)) {
        dotenv.config({ path: rootEnvPath });
        console.log(`✅ Loaded ${rootEnvPath}`);
      }

      // Load environment-specific override
      const nodeEnv = process.env.NODE_ENV ?? "development";
      const envSpecificPath = resolve(process.cwd(), `.env.${nodeEnv}`);
      if (existsSync(envSpecificPath)) {
        dotenv.config({ path: envSpecificPath, override: true });
        console.log(`✅ Loaded ${envSpecificPath}`);
      }
    } else {
      // Local development mode - use relative paths from bot directory
      console.log("🔧 Loading environment variables for local development...");

      // Get the project root (3 levels up from this file: bot/src/functions/general/)
      const projectRoot = resolve(__dirname, "../../../../");

      // Load root .env first
      const rootEnvPath = resolve(projectRoot, ".env");
      if (existsSync(rootEnvPath)) {
        dotenv.config({ path: rootEnvPath });
        console.log(`✅ Loaded ${rootEnvPath}`);
      }

      // Load environment-specific override
      const nodeEnv = process.env.NODE_ENV ?? "development";
      const envSpecificPath = resolve(projectRoot, `.env.${nodeEnv}`);
      if (existsSync(envSpecificPath)) {
        dotenv.config({ path: envSpecificPath, override: true });
        console.log(`✅ Loaded ${envSpecificPath}`);
      }

      // Also try local bot-specific files as final override
      const botDir = resolve(__dirname, "../../../");
      const botEnvPath = resolve(botDir, ".env");
      if (existsSync(botEnvPath)) {
        dotenv.config({ path: botEnvPath, override: true });
        console.log(`✅ Loaded bot-specific ${botEnvPath}`);
      }

      const botEnvLocalPath = resolve(botDir, ".env.local");
      if (existsSync(botEnvLocalPath)) {
        dotenv.config({ path: botEnvLocalPath, override: true });
        console.log(`✅ Loaded bot-specific ${botEnvLocalPath}`);
      }
    }

    environmentLoaded = true;
    console.log(`✅ Environment loading complete. NODE_ENV=${process.env.NODE_ENV ?? "development"}`);
  } catch (error) {
    console.error("❌ Failed to load environment variables:", error);
    // Don't exit here, let the application handle missing vars
  }
}

/**
 * Check if environment has been loaded
 */
export function isEnvironmentLoaded(): boolean {
  return environmentLoaded;
}
