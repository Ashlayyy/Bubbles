import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildMemberAvailable, async (member) => {
  const client = member.client as import("../../structures/Client.js").default;

  // Log when a member becomes available in a large guild
  await client.logManager.log(member.guild.id, "GUILD_MEMBER_AVAILABLE", {
    executorId: member.id,
    metadata: {
      userId: member.id,
      username: member.user.username,
      displayName: member.displayName,
      joinedAt: member.joinedAt?.toISOString(),
      roles: member.roles.cache.map((role) => role.id),
      guildMemberCount: member.guild.memberCount,
      timestamp: new Date().toISOString(),
    },
  });
});
