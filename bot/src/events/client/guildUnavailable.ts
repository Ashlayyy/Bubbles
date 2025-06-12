import type { Guild } from "discord.js";
import { Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildUnavailable, async (guild: Guild) => {
  const client = guild.client as import("../../structures/Client.js").default;

  try {
    logger.warn(`Guild ${guild.name} (${guild.id}) became unavailable - possible Discord outage`);

    // Log the unavailability for monitoring
    await client.logManager.log(guild.id, "GUILD_UNAVAILABLE", {
      executorId: client.user?.id ?? "SYSTEM",
      metadata: {
        guildName: guild.name,
        guildId: guild.id,
        memberCount: guild.memberCount,
        timestamp: new Date().toISOString(),
        possibleOutage: true,
      },
    });

    // Optional: Alert administrators about potential issues
    // You could implement a notification system here for critical guilds
  } catch (error) {
    logger.error("Error handling guild unavailable:", error);
  }
});
