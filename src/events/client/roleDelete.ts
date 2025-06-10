import type { Role } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildRoleDelete, async (role: Role) => {
  const client = role.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who deleted the role
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await role.guild.fetchAuditLogs({
      type: 32, // ROLE_DELETE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === role.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the role deletion
  await client.logManager.log(role.guild.id, "ROLE_DELETE", {
    roleId: role.id,
    executorId,
    reason: reason ?? "No reason provided",
    metadata: {
      roleName: role.name,
      roleColor: role.color.toString(16),
      rolePosition: role.position,
      rolePermissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      hoisted: role.hoist,
      managed: role.managed,
      memberCount: role.members.size,
      timestamp: new Date().toISOString(),
    },
  });
});
