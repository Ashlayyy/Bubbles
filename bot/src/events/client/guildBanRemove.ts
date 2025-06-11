import type { GuildBan } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildBanRemove, async (ban: GuildBan) => {
  const client = ban.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who removed the ban
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await ban.guild.fetchAuditLogs({
      type: 23, // MEMBER_BAN_REMOVE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry && auditEntry.target?.id === ban.user.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the unban
  await client.logManager.log(ban.guild.id, "MEMBER_UNBAN", {
    userId: ban.user.id,
    executorId,
    reason: reason ?? "No reason provided",
    metadata: {
      username: ban.user.username,
      discriminator: ban.user.discriminator,
      previousBanReason: ban.reason ?? "Unknown",
      timestamp: new Date().toISOString(),
    },
  });
});
