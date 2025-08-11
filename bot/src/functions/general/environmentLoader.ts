import { PathResolver } from "@shared/utils/pathResolver";
import dotenvExpand from "dotenv-expand";
import * as dotenvFlow from "dotenv-flow";

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
    // Get paths using the centralized path resolver
    const paths = PathResolver.getCommonPaths(import.meta.url);

    // Enhanced debugging for path resolution
    console.log(`🔧 Environment Loader Debug:`);
    console.log(`   Project Root: ${paths.projectRoot}`);
    console.log(`   Bot Root: ${paths.botRoot}`);
    console.log(`   Current Working Directory: ${process.cwd()}`);
    console.log(`   PM2_HOME: ${process.env.PM2_HOME || "not set"}`);
    console.log(`   process.env.name: ${process.env.name || "not set"}`);
    console.log(`   process.env.NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
    console.log(`   REDIS_URL: ${process.env.REDIS_URL || "not set"}`);
    console.log(`   REDIS_USERNAME: ${process.env.REDIS_USERNAME || "not set"}`);
    console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD || "not set"}`);
    console.log(`   REDIS_PORT: ${process.env.REDIS_PORT || "not set"}`);
    
    // Determine if we're running under PM2 or locally
    const isRunningUnderPM2 = process.env.PM2_HOME !== undefined || process.env.name?.startsWith("bubbles-") === true;

    if (isRunningUnderPM2) {
      // PM2 mode - PM2 should set the working directory correctly
      console.log("🔧 Loading environment variables for PM2...");

      // For PM2, try the project root first
      const result = dotenvFlow.config({
        path: paths.projectRoot,
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      }) as { parsed?: Record<string, string>; error?: Error };

      if (result?.parsed && !result.error) {
        // Enable variable expansion
        dotenvExpand.expand({ parsed: result.parsed });
        console.log(`✅ Loaded environment files from ${paths.projectRoot}`);
      } else {
        // Fallback to current working directory for PM2
        const fallbackResult = dotenvFlow.config({
          path: process.cwd(),
          pattern: ".env[.node_env][.local]",
          node_env: process.env.NODE_ENV ?? "development",
        }) as { parsed?: Record<string, string>; error?: Error };

        if (fallbackResult?.parsed && !fallbackResult.error) {
          dotenvExpand.expand({ parsed: fallbackResult.parsed });
          console.log(`✅ Loaded environment files from ${process.cwd()} (PM2 fallback)`);
        }
      }
    } else {
      // Local development mode - use absolute paths from module location
      console.log("🔧 Loading environment variables for local development...");

      // Load from project root with dotenv-flow
      const result = dotenvFlow.config({
        path: paths.projectRoot,
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      }) as { parsed?: Record<string, string>; error?: Error };

      if (result?.parsed && !result.error) {
        // Enable variable expansion
        dotenvExpand.expand({ parsed: result.parsed });
        console.log(`✅ Loaded environment files from ${paths.projectRoot}`);
      }

      // Also try bot-specific files as final override
      const botResult = dotenvFlow.config({
        path: paths.botRoot,
        pattern: ".env[.node_env][.local]",
        node_env: process.env.NODE_ENV ?? "development",
      }) as { parsed?: Record<string, string>; error?: Error };

      if (botResult?.parsed && !botResult.error) {
        dotenvExpand.expand({ parsed: botResult.parsed });
        console.log(`✅ Loaded bot-specific environment files from ${paths.botRoot}`);
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
