import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardReady, async (shardId: number, unavailableGuilds?: Set<string>) => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  console.log(`Shard ${shardId} is ready!`);

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "SHARD_READY", {
      metadata: {
        shardId,
        unavailableGuildsCount: unavailableGuilds?.size ?? 0,
        unavailableGuilds: unavailableGuilds ? Array.from(unavailableGuilds) : [],
        timestamp: new Date().toISOString(),
      },
    });
  }
});
