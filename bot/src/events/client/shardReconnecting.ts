import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardReconnecting, async (shardId: number) => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  console.log(`Shard ${shardId} is attempting to reconnect...`);

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "SHARD_RECONNECTING", {
      metadata: {
        shardId,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
