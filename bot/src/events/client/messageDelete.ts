import type { Prisma } from "@prisma/client";
import type { Message, PartialMessage } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.MessageDelete, async (message: Message | PartialMessage) => {
  // Only process messages in guilds
  if (!message.guild) return;

  const client = message.client as import("../../structures/Client.js").default;

  // Get additional context information
  const member =
    message.member ?? (message.author ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);
  const channel = message.channel;

  // Calculate account age if we have author info
  let accountAge = "";
  if (message.author) {
    const createdAt = message.author.createdAt;
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    accountAge = ageDays < 30 ? `${ageDays} days` : `${Math.floor(ageDays / 30)} months`;
  }

  // Enhanced metadata with comprehensive information
  const enhancedMetadata = {
    messageId: message.id,
    timestamp: message.createdAt.toISOString(),
    hasAttachments: message.attachments.size > 0,
    hasEmbeds: message.embeds.length > 0,
    wasCached: !!message.author, // If we have author info, message was cached
    messageLength: message.content?.length ?? 0,
    channelType: channel.type,
    channelName: "name" in channel ? channel.name : "Unknown",
    memberCount: message.guild.memberCount,
    accountAge: accountAge,
    joinedAt: member?.joinedAt?.toISOString(),
    roles: member?.roles.cache.map((role) => role.id) ?? [],
    isPinned: message.pinned,
    isSystemMessage: message.system,
    messageType: message.type,
    editedTimestamp: message.editedTimestamp ? new Date(message.editedTimestamp).toISOString() : null,
    webhookId: message.webhookId,
    applicationId: message.applicationId,
    flags: message.flags.toArray(),
  };

  // Log the message deletion with enhanced data
  await client.logManager.log(message.guild.id, "MESSAGE_DELETE", {
    userId: message.author?.id,
    channelId: message.channel.id,
    content: message.content ?? "[Content not cached]",
    attachments: Array.from(message.attachments.values()).map((att) => att.url),
    embeds: message.embeds.map((embed) => embed.toJSON()) as Prisma.InputJsonValue[],
    metadata: enhancedMetadata,
  });
});
