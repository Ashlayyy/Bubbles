import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use centralized environment loading
const environmentLoaderPath = path.resolve(__dirname, "src/functions/general/environmentLoader.js");
try {
  const { loadEnvironment } = (await import(environmentLoaderPath)) as { loadEnvironment: () => void };
  loadEnvironment();
} catch (error) {
  // Fallback to basic environment loading if the module isn't built yet
  console.warn("⚠️ Using fallback environment loading for shard.ts");
  const rootEnvPath = path.resolve(__dirname, "../.env");
  dotenv.config({ path: rootEnvPath });

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envSpecificPath = path.resolve(__dirname, `../.env.${nodeEnv}`);
  dotenv.config({ path: envSpecificPath, override: true });
}

import { ShardingManager } from "discord.js";

// Create sharding manager
const manager = new ShardingManager(path.join(__dirname, "build", "bot", "src", "index.js"), {
  token: process.env.DISCORD_TOKEN || "",
  totalShards: "auto", // Discord will determine the optimal number
  // totalShards: 4, // Or specify manually
  respawn: true,
  shardArgs: [],
  execArgv: [],
});

// Event handlers for shard management
manager.on("shardCreate", (shard) => {
  console.log(`🚀 Launched shard ${shard.id}`);

  // Shard ready event
  shard.on("ready", () => {
    console.log(`✅ Shard ${shard.id} is ready`);
  });

  // Shard error handling
  shard.on("error", (error) => {
    console.error(`❌ Shard ${shard.id} encountered an error:`, error);
  });

  // Shard disconnect handling
  shard.on("disconnect", () => {
    console.warn(`⚠️ Shard ${shard.id} disconnected`);
  });

  // Shard reconnecting
  shard.on("reconnecting", () => {
    console.log(`🔄 Shard ${shard.id} reconnecting...`);
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
