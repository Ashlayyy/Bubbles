import { Events, type DMChannel, type NonThreadGuildBasedChannel } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.ChannelUpdate,
  async (oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) => {
    // Only process guild channels
    if (!("guild" in newChannel)) return;

    const client = newChannel.client as import("../../structures/Client.js").default;

    // Simple check for basic changes
    const changes: string[] = [];

    if ("name" in oldChannel && "name" in newChannel && oldChannel.name !== newChannel.name) {
      changes.push("name");
    }

    if ("position" in oldChannel && "position" in newChannel && oldChannel.position !== newChannel.position) {
      changes.push("position");
    }

    if ("parentId" in oldChannel && "parentId" in newChannel && oldChannel.parentId !== newChannel.parentId) {
      changes.push("parent");
    }

    // Try to get audit log information
    let executorId: string | undefined;
    let reason: string | undefined;

    try {
      const auditLogs = await newChannel.guild.fetchAuditLogs({
        type: 11, // CHANNEL_UPDATE
        limit: 1,
      });

      const auditEntry = auditLogs.entries.first();
      if (auditEntry?.target && auditEntry.target.id === newChannel.id) {
        executorId = auditEntry.executor?.id;
        reason = auditEntry.reason ?? undefined;
      }
    } catch {
      // Audit log fetch failed
    }

    // Log the channel update if there are changes
    if (changes.length > 0) {
      await client.logManager.log(newChannel.guild.id, "CHANNEL_UPDATE", {
        channelId: newChannel.id,
        executorId,
        reason: reason ?? "No reason provided",
        metadata: {
          channelName: newChannel.name,
          channelType: newChannel.type,
          changes,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);
