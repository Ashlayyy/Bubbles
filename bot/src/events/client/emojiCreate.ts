import type { GuildEmoji } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildEmojiCreate, async (emoji: GuildEmoji) => {
  const client = emoji.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who created the emoji
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await emoji.guild.fetchAuditLogs({
      type: 60, // EMOJI_CREATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === emoji.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the emoji creation
  await client.logManager.log(emoji.guild.id, "EMOJI_CREATE", {
    executorId,
    reason: reason ?? "No reason provided",
    metadata: {
      emojiId: emoji.id,
      emojiName: emoji.name,
      emojiURL: emoji.url,
      animated: emoji.animated,
      managed: emoji.managed,
      available: emoji.available,
      timestamp: new Date().toISOString(),
    },
  });
});
