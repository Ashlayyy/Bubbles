import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.MessageBulkDelete, async (messages) => {
  const firstMessage = messages.first();
  if (!firstMessage?.guild) return;

  const client = firstMessage.client as import("../../structures/Client.js").default;

  // Count cached vs uncached messages
  const cachedMessages = messages.filter((m) => m.author !== null);
  const uncachedCount = messages.size - cachedMessages.size;

  // Get channel information
  const channel = firstMessage.channel;

  // Try to get audit log information for who performed the bulk delete
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await firstMessage.guild.fetchAuditLogs({
      type: 73, // MESSAGE_BULK_DELETE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.extra && typeof auditEntry.extra === "object" && "channel" in auditEntry.extra) {
      const extra = auditEntry.extra as { channel: { id: string }; count: number };
      if (extra.channel.id === channel.id) {
        executorId = auditEntry.executor?.id;
        reason = auditEntry.reason ?? undefined;
      }
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Prepare metadata about the deleted messages
  const messagesData = cachedMessages.map((msg) => ({
    id: msg.id,
    authorId: msg.author?.id,
    content: msg.content ?? "[Content not cached]",
    createdAt: msg.createdAt.toISOString(),
    attachments: msg.attachments.size,
    embeds: msg.embeds.length,
  }));

  // Log the bulk deletion
  await client.logManager.log(firstMessage.guild.id, "MESSAGE_BULK_DELETE", {
    channelId: channel.id,
    executorId,
    reason: reason ?? "No reason provided",
    metadata: {
      totalCount: messages.size,
      cachedCount: cachedMessages.size,
      uncachedCount,
      channelName: "name" in channel ? channel.name : "Unknown",
      channelType: channel.type,
      oldestMessageId: messages.last()?.id,
      newestMessageId: messages.first()?.id,
      messagesData: messagesData.slice(0, 50), // Limit to prevent excessive data
      timestamp: new Date().toISOString(),
    },
  });
});
