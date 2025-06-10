import type { GuildBan } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildBanAdd, async (ban: GuildBan) => {
  const client = ban.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who executed the ban
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await ban.guild.fetchAuditLogs({
      type: 22, // MEMBER_BAN_ADD
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

  // Log the ban
  await client.logManager.log(ban.guild.id, "MEMBER_BAN", {
    userId: ban.user.id,
    executorId,
    reason: reason ?? ban.reason ?? "No reason provided",
    metadata: {
      username: ban.user.username,
      discriminator: ban.user.discriminator,
      timestamp: new Date().toISOString(),
    },
  });
});
