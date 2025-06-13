import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.Invalidated, async () => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  // Log the session invalidation - this is critical for monitoring
  console.error("Client session has been invalidated! Bot will need to restart.");

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "CLIENT_INVALIDATED", {
      metadata: {
        timestamp: new Date().toISOString(),
        reason: "Session invalidated by Discord",
        uptime: process.uptime(),
      },
    });
  }

  // Graceful shutdown
  process.exit(1);
});
