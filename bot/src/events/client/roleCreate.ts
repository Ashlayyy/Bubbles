import type { Role } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildRoleCreate, async (role: Role) => {
  const client = role.client as import("../../structures/Client.js").default;

  // Try to get audit log information for who created the role
  let executorId: string | undefined;

  try {
    const auditLogs = await role.guild.fetchAuditLogs({
      type: 30, // ROLE_CREATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry && auditEntry.target?.id === role.id) {
      executorId = auditEntry.executor?.id;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the role creation
  await client.logManager.log(role.guild.id, "ROLE_CREATE", {
    roleId: role.id,
    executorId,
    metadata: {
      roleName: role.name,
      roleColor: role.color.toString(16),
      rolePosition: role.position,
      rolePermissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      hoisted: role.hoist,
      managed: role.managed,
      timestamp: new Date().toISOString(),
    },
  });
});
