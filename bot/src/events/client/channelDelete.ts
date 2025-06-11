import type { DMChannel, GuildChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ChannelDelete, async (channel: DMChannel | GuildChannel) => {
  // Only process guild channels
  if (!("guild" in channel)) return;

  const client = channel.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who deleted the channel
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: 12, // CHANNEL_DELETE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === channel.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the channel deletion
  await client.logManager.log(channel.guild.id, "CHANNEL_DELETE", {
    channelId: channel.id,
    executorId,
    reason: reason ?? "No reason provided",
    metadata: {
      channelName: channel.name,
      channelType: channel.type,
      parentId: channel.parentId,
      position: channel.position,
      timestamp: new Date().toISOString(),
    },
  });
});
