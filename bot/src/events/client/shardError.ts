import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardError, async (error: Error, shardId: number) => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  console.error(`Shard ${shardId} encountered an error:`, error);

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "SHARD_ERROR", {
      metadata: {
        shardId,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
