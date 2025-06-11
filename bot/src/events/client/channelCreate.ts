import type { GuildChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ChannelCreate, async (channel: GuildChannel) => {
  const client = channel.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who created the channel
  let executorId: string | undefined;

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: 10, // CHANNEL_CREATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry && auditEntry.target?.id === channel.id) {
      executorId = auditEntry.executor?.id;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the channel creation
  await client.logManager.log(channel.guild.id, "CHANNEL_CREATE", {
    channelId: channel.id,
    executorId,
    metadata: {
      channelName: channel.name,
      channelType: channel.type,
      parentId: channel.parentId,
      position: channel.position,
      timestamp: new Date().toISOString(),
    },
  });
});
