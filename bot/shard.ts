import { PathResolver } from "@shared/utils/pathResolver";
import { config as dotenvConfig } from "dotenv";
import path from "path";

// Get paths using the centralized path resolver
const paths = PathResolver.getCommonPaths(import.meta.url);

// Use centralized environment loading
const environmentLoaderPath = path.join(paths.botRoot, "build/src/functions/general/environmentLoader.js");
try {
  const { loadEnvironment } = (await import(environmentLoaderPath)) as { loadEnvironment: () => void };
  loadEnvironment();
} catch (_error) {
  // Fallback to basic environment loading if the module isn't built yet
  console.warn("⚠️ Using fallback environment loading for shard.ts");
  const rootEnvPath = paths.envFile;
  dotenvConfig({ path: rootEnvPath });

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envSpecificPath = path.join(paths.projectRoot, `.env.${nodeEnv}`);
  dotenvConfig({ path: envSpecificPath, override: true });
}

import { ShardingManager } from "discord.js";

// Create sharding manager
const manager = new ShardingManager(path.join(paths.botRoot, "build/src/index.js"), {
  token: process.env.DISCORD_TOKEN || "",
  totalShards: "auto", // Discord will determine the optimal number
  // totalShards: 4, // Or specify manually
  respawn: true,
  shardArgs: [],
  execArgv: [],
});

// Event handlers for shard management
manager.on("shardCreate", (shard) => {
  console.log(`🚀 Launched shard ${String(shard.id)}`);

  // Shard ready event
  shard.on("ready", () => {
    console.log(`✅ Shard ${String(shard.id)} is ready`);
  });

  // Shard error handling
  shard.on("error", (error) => {
    console.error(`❌ Shard ${String(shard.id)} encountered an error:`, error);
  });

  // Shard disconnect handling
  shard.on("disconnect", () => {
    console.warn(`⚠️ Shard ${String(shard.id)} disconnected`);
  });

  // Shard reconnecting
  shard.on("reconnecting", () => {
    console.log(`🔄 Shard ${String(shard.id)} reconnecting...`);
  });
});

// Global error handling for sharding manager
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection in sharding manager:", error);
});

// Start spawning shards
console.log("🎯 Starting Discord bot with sharding...");
void manager.spawn({ timeout: -1 });

// Graceful shutdown handling
process.on("SIGINT", () => {
  void (async () => {
    console.log("🛑 Shutting down shards...");

    try {
      await manager.broadcastEval((client) => client.destroy());
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  })();
});

// Export manager for external access
export default manager;
