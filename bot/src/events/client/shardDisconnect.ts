import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardDisconnect, async (event, shardId) => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  console.error(`Shard ${shardId} disconnected`);

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "SHARD_DISCONNECT", {
      metadata: {
        shardId,
        code: event.code,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
