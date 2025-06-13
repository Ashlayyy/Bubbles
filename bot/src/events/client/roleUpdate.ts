import type { Role } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildRoleUpdate, async (oldRole: Role, newRole: Role) => {
  const client = newRole.client as import("../../structures/Client.js").default;

  // Compare role changes
  const changes: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Check for name changes
  if (oldRole.name !== newRole.name) {
    changes.push("name");
    before.name = oldRole.name;
    after.name = newRole.name;
  }

  // Check for color changes
  if (oldRole.color !== newRole.color) {
    changes.push("color");
    before.color = oldRole.color.toString(16);
    after.color = newRole.color.toString(16);
  }

  // Check for position changes
  if (oldRole.position !== newRole.position) {
    changes.push("position");
    before.position = oldRole.position;
    after.position = newRole.position;
  }

  // Check for permission changes
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    changes.push("permissions");
    before.permissions = oldRole.permissions.bitfield.toString();
    after.permissions = newRole.permissions.bitfield.toString();
  }

  // Check for mentionable changes
  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push("mentionable");
    before.mentionable = oldRole.mentionable;
    after.mentionable = newRole.mentionable;
  }

  // Check for hoisted changes
  if (oldRole.hoist !== newRole.hoist) {
    changes.push("hoisted");
    before.hoisted = oldRole.hoist;
    after.hoisted = newRole.hoist;
  }

  // Try to get audit log information for who made the change
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: 31, // ROLE_UPDATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === newRole.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the role update if there are changes
  if (changes.length > 0) {
    // Emit granular role change events
    const changeTypeMap: Record<string, string> = {
      name: "ROLE_NAME_CHANGE",
      color: "ROLE_COLOR_CHANGE",
      position: "ROLE_POSITION_CHANGE",
      permissions: "ROLE_PERMISSIONS_UPDATE",
      mentionable: "ROLE_MENTIONABLE_CHANGE",
      hoisted: "ROLE_HOIST_CHANGE",
    };

    for (const prop of changes) {
      const logType = changeTypeMap[prop];
      if (logType) {
        await client.logManager.log(newRole.guild.id, logType, {
          roleId: newRole.id,
          executorId,
          reason: reason ?? "No reason provided",
          before: JSON.stringify({ [prop]: before[prop] }),
          after: JSON.stringify({ [prop]: after[prop] }),
          metadata: {
            roleName: newRole.name,
            change: prop,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Fallback combined ROLE_UPDATE for completeness
    await client.logManager.log(newRole.guild.id, "ROLE_UPDATE", {
      roleId: newRole.id,
      executorId,
      reason: reason ?? "No reason provided",
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      metadata: {
        roleName: newRole.name,
        changes,
        memberCount: newRole.members.size,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
