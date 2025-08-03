import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardDisconnect, async (event, shardId) => {
  // Get client from global instance
  const client = await import("../../structures/Client.js").then((m) => m.default.get());

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
