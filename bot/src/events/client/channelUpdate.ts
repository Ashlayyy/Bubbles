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
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if ("name" in oldChannel && "name" in newChannel && oldChannel.name !== newChannel.name) {
      changes.push("name");
      before.name = oldChannel.name;
      after.name = newChannel.name;
    }

    if ("topic" in oldChannel && "topic" in newChannel && oldChannel.topic !== newChannel.topic) {
      changes.push("topic");
      before.topic = oldChannel.topic;
      after.topic = newChannel.topic;
    }

    if (
      "rateLimitPerUser" in oldChannel &&
      "rateLimitPerUser" in newChannel &&
      oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
    ) {
      changes.push("slowmode");
      before.slowmode = oldChannel.rateLimitPerUser;
      after.slowmode = newChannel.rateLimitPerUser;
    }

    if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
      changes.push("nsfw");
      before.nsfw = oldChannel.nsfw;
      after.nsfw = newChannel.nsfw;
    }

    if ("position" in oldChannel && "position" in newChannel && oldChannel.position !== newChannel.position) {
      changes.push("position");
      before.position = oldChannel.position;
      after.position = newChannel.position;
    }

    if ("parentId" in oldChannel && "parentId" in newChannel && oldChannel.parentId !== newChannel.parentId) {
      changes.push("parent");
      before.parentId = oldChannel.parentId;
      after.parentId = newChannel.parentId;
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
      const changeTypeMap: Record<string, string> = {
        name: "CHANNEL_NAME_CHANGE",
        topic: "CHANNEL_TOPIC_CHANGE",
        slowmode: "CHANNEL_SLOWMODE_CHANGE",
        nsfw: "CHANNEL_NSFW_CHANGE",
        position: "CHANNEL_POSITION_CHANGE",
        parent: "CHANNEL_CATEGORY_CHANGE",
      };

      for (const prop of changes) {
        const logType = changeTypeMap[prop];
        if (logType) {
          await client.logManager.log(newChannel.guild.id, logType, {
            channelId: newChannel.id,
            executorId,
            reason: reason ?? "No reason provided",
            before: JSON.stringify({ [prop]: before[prop] }),
            after: JSON.stringify({ [prop]: after[prop] }),
            metadata: {
              channelName: newChannel.name,
              channelType: newChannel.type,
              change: prop,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generic update
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
