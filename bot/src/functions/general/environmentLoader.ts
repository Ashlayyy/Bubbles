import dotenvExpand from "dotenv-expand";
import * as dotenvFlow from "dotenv-flow";
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

      // Use dotenv-flow for PM2 mode
      const result = dotenvFlow.config({
        path: process.cwd(),
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      });

      if (result && !result.error && result.parsed) {
        // Enable variable expansion
        dotenvExpand.expand(result);
        console.log(`✅ Loaded environment files from ${process.cwd()}`);
      }
    } else {
      // Local development mode - use relative paths from bot directory
      console.log("🔧 Loading environment variables for local development...");

      // Get the project root (3 levels up from this file: bot/src/functions/general/)
      const projectRoot = resolve(__dirname, "../../../../");

      // Load from project root with dotenv-flow
      const result = dotenvFlow.config({
        path: projectRoot,
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      });

      if (result && !result.error && result.parsed) {
        // Enable variable expansion
        dotenvExpand.expand(result);
        console.log(`✅ Loaded environment files from ${projectRoot}`);
      }

      // Also try bot-specific files as final override
      const botDir = resolve(__dirname, "../../../");
      const botResult = dotenvFlow.config({
        path: botDir,
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      });

      if (botResult && !botResult.error && botResult.parsed) {
        dotenvExpand.expand(botResult);
        console.log(`✅ Loaded bot-specific environment files from ${botDir}`);
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
