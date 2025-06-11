import type { GuildEmoji } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildEmojiUpdate, async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
  const client = newEmoji.client as import("../../structures/Client.js").default;

  // Compare emoji changes
  const changes: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Check for name changes
  if (oldEmoji.name !== newEmoji.name) {
    changes.push("name");
    before.name = oldEmoji.name;
    after.name = newEmoji.name;
  }

  // Try to get audit log information for who made the change
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await newEmoji.guild.fetchAuditLogs({
      type: 61, // EMOJI_UPDATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === newEmoji.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed
  }

  // Log the emoji update if there are changes
  if (changes.length > 0) {
    await client.logManager.log(newEmoji.guild.id, "EMOJI_UPDATE", {
      executorId,
      reason: reason ?? "No reason provided",
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      metadata: {
        emojiId: newEmoji.id,
        emojiName: newEmoji.name,
        emojiURL: newEmoji.url,
        animated: newEmoji.animated,
        managed: newEmoji.managed,
        available: newEmoji.available,
        changes,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
