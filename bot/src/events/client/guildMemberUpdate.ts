import type { GuildMember, PartialGuildMember } from "discord.js";
import { Events } from "discord.js";

import { prisma } from "../../database/index.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.GuildMemberUpdate,
  async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const client = newMember.client as import("../../structures/Client.js").default;

    // Compare member changes
    const changes: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    // Check for nickname changes
    if (oldMember.nickname !== newMember.nickname) {
      changes.push("nickname");
      before.nickname = oldMember.nickname;
      after.nickname = newMember.nickname;
    }

    // Check for role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      changes.push("roles");
      before.roles = oldRoles.map((role) => ({ id: role.id, name: role.name }));
      after.roles = newRoles.map((role) => ({ id: role.id, name: role.name }));
    }

    // Check for avatar changes
    if (oldMember.avatar !== newMember.avatar) {
      changes.push("avatar");
      before.avatar = oldMember.avatar;
      after.avatar = newMember.avatar;
    }

    // Check for timeout changes
    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
      changes.push("timeout");
      before.communicationDisabledUntil = oldMember.communicationDisabledUntil?.toISOString();
      after.communicationDisabledUntil = newMember.communicationDisabledUntil?.toISOString();
    }

    // NEW_CODE: Automatically resolve expired timeouts
    if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
      try {
        const guildId = newMember.guild.id;
        const userId = newMember.id;

        // Find the latest active TIMEOUT moderation case
        const modCase = await prisma.moderationCase.findFirst({
          where: { guildId, userId, type: "TIMEOUT", isActive: true },
          orderBy: { caseNumber: "desc" },
        });

        if (modCase) {
          await prisma.moderationCase.update({
            where: { id: modCase.id },
            data: {
              isActive: false,
              staffNote: "Timeout expired automatically",
            },
          });
        }

        // Emit dedicated moderation log entry
        await client.logManager.log(guildId, "MOD_UNTIMEOUT", {
          userId,
          executorId: client.user?.id,
          reason: "Timeout expired automatically",
          caseId: modCase?.id,
          metadata: { caseNumber: modCase?.caseNumber },
        });
      } catch (err) {
        console.warn("[guildMemberUpdate] Failed to process automatic untimeout:", err);
      }
    }

    // Try to get audit log information for who made the change
    let executorId: string | undefined;
    let reason: string | undefined;

    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: 24, // MEMBER_UPDATE
        limit: 1,
      });

      const auditEntry = auditLogs.entries.first();
      if (auditEntry?.target && auditEntry.target.id === newMember.id) {
        executorId = auditEntry.executor?.id;
        reason = auditEntry.reason ?? undefined;
      }
    } catch {
      // Audit log fetch failed
    }

    // Log the member update if there are changes
    if (changes.length > 0) {
      await client.logManager.log(newMember.guild.id, "MEMBER_UPDATE", {
        userId: newMember.id,
        executorId,
        reason: reason ?? "No reason provided",
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        metadata: {
          username: newMember.user.username,
          displayName: newMember.displayName,
          changes,
          addedRoles: addedRoles.map((role) => ({ id: role.id, name: role.name })),
          removedRoles: removedRoles.map((role) => ({ id: role.id, name: role.name })),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);
