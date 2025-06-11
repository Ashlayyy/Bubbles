import type { Guild } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildUpdate, async (oldGuild: Guild, newGuild: Guild) => {
  const client = newGuild.client as import("../../structures/Client.js").default;

  // Compare guild changes
  const changes: string[] = [];

  // Check for name changes
  if (oldGuild.name !== newGuild.name) {
    changes.push("name");
  }

  // Check for icon changes
  if (oldGuild.icon !== newGuild.icon) {
    changes.push("icon");
  }

  // Check for banner changes
  if (oldGuild.banner !== newGuild.banner) {
    changes.push("banner");
  }

  // Check for description changes
  if (oldGuild.description !== newGuild.description) {
    changes.push("description");
  }

  // Check for verification level changes
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
    changes.push("verification_level");
  }

  // Check for explicit content filter changes
  if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
    changes.push("explicit_content_filter");
  }

  // Check for default message notifications changes
  if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
    changes.push("default_message_notifications");
  }

  // Check for system channel changes
  if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
    changes.push("system_channel");
  }

  // Check for AFK channel changes
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
    changes.push("afk_channel");
  }

  // Check for AFK timeout changes
  if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
    changes.push("afk_timeout");
  }

  // Try to get audit log information for who made the change
  let executorId: string | undefined;
  let reason: string | undefined;

  try {
    const auditLogs = await newGuild.fetchAuditLogs({
      type: 1, // GUILD_UPDATE
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry?.target && auditEntry.target.id === newGuild.id) {
      executorId = auditEntry.executor?.id;
      reason = auditEntry.reason ?? undefined;
    }
  } catch {
    // Audit log fetch failed, continue without executor info
  }

  // Log the guild update if there are changes
  if (changes.length > 0) {
    await client.logManager.log(newGuild.id, "GUILD_UPDATE", {
      executorId,
      reason: reason ?? "No reason provided",
      metadata: {
        guildName: newGuild.name,
        changes,
        before: {
          name: oldGuild.name,
          icon: oldGuild.icon,
          banner: oldGuild.banner,
          description: oldGuild.description,
          verificationLevel: oldGuild.verificationLevel,
          explicitContentFilter: oldGuild.explicitContentFilter,
          defaultMessageNotifications: oldGuild.defaultMessageNotifications,
          systemChannelId: oldGuild.systemChannelId,
          afkChannelId: oldGuild.afkChannelId,
          afkTimeout: oldGuild.afkTimeout,
        },
        after: {
          name: newGuild.name,
          icon: newGuild.icon,
          banner: newGuild.banner,
          description: newGuild.description,
          verificationLevel: newGuild.verificationLevel,
          explicitContentFilter: newGuild.explicitContentFilter,
          defaultMessageNotifications: newGuild.defaultMessageNotifications,
          systemChannelId: newGuild.systemChannelId,
          afkChannelId: newGuild.afkChannelId,
          afkTimeout: newGuild.afkTimeout,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
});
