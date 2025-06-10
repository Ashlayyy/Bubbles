import type { Guild } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildDelete, async (guild: Guild) => {
  const client = guild.client as import("../../structures/Client.js").default;

  // Log the bot leaving a guild
  await client.logManager.log(guild.id, "BOT_GUILD_LEAVE", {
    metadata: {
      guildName: guild.name,
      guildId: guild.id,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      unavailable: !guild.available, // Guild became unavailable vs. actually left
      timestamp: new Date().toISOString(),
    },
  });
});
