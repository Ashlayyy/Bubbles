import type { Guild } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildCreate, async (guild: Guild) => {
  const client = guild.client as import("../../structures/Client.js").default;

  // Log the bot joining a new guild
  await client.logManager.log(guild.id, "BOT_GUILD_JOIN", {
    metadata: {
      guildName: guild.name,
      guildId: guild.id,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdAt.toISOString(),
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      features: guild.features,
      premiumTier: guild.premiumTier,
      premiumSubscriptionCount: guild.premiumSubscriptionCount,
      preferredLocale: guild.preferredLocale,
      description: guild.description,
      icon: guild.icon,
      banner: guild.banner,
      timestamp: new Date().toISOString(),
    },
  });
});
