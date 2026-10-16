import type { GuildMember, PartialGuildMember } from "discord.js";
import { Events } from "discord.js";

import { prisma } from "../../database/index.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.GuildMemberUpdate,
  async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const client = newMember.client as import("../../structures/Client.js").default;
    const startTime = Date.now();

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

    // Check for role changes (optimized)
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

    // NEW_CODE: Automatically resolve expired timeouts (async)
    const timeoutPromise = (async () => {
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
    })();

    // Try to get audit log information for who made the change (async, non-blocking)
    const auditLogPromise = (async () => {
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: 24, // MEMBER_UPDATE
          limit: 1,
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry?.target && auditEntry.target.id === newMember.id) {
          return {
            executorId: auditEntry.executor?.id,
            reason: auditEntry.reason ?? "No reason provided",
          };
        }
      } catch {
        // Audit log fetch failed
      }
      return { executorId: undefined, reason: "No reason provided" };
    })();

    // Log the member update if there are changes (async)
    const logPromise = (async () => {
      if (changes.length > 0) {
        const auditInfo = await auditLogPromise;

        await client.logManager.log(newMember.guild.id, "MEMBER_UPDATE", {
          userId: newMember.id,
          executorId: auditInfo.executorId,
          reason: auditInfo.reason,
          before: JSON.stringify(before),
          after: JSON.stringify(after),
          metadata: {
            username: newMember.user.username,
            displayName: newMember.displayName,
            changes,
            addedRoles: addedRoles.map((role) => ({ id: role.id, name: role.name })),
            removedRoles: removedRoles.map((role) => ({ id: role.id, name: role.name })),
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
          },
        });
      }
    })();

    // Wait for all operations to complete
    try {
      await Promise.allSettled([timeoutPromise, logPromise]);
      const totalTime = Date.now() - startTime;

      // Log performance if it's slow
      if (totalTime > 1000) {
        console.warn(
          `Slow member update processing: ${totalTime}ms for user ${newMember.id} in guild ${newMember.guild.id}`
        );
      }
    } catch (error) {
      console.error("Error in member update event:", error);
    }
  }
);
