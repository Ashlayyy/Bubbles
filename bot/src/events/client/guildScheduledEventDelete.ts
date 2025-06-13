import type { GuildScheduledEvent, PartialGuildScheduledEvent } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.GuildScheduledEventDelete,
  async (guildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent) => {
    if (!guildScheduledEvent.guild) return;

    const client = guildScheduledEvent.client as import("../../structures/Client.js").default;

    try {
      await client.logManager.log(guildScheduledEvent.guild.id, "SCHEDULED_EVENT_DELETE", {
        executorId: guildScheduledEvent.creatorId ?? undefined,
        metadata: {
          eventId: guildScheduledEvent.id,
          eventName: guildScheduledEvent.name ?? "Unknown",
          eventDescription: guildScheduledEvent.description ?? null,
          scheduledStartTime: guildScheduledEvent.scheduledStartTimestamp ?? null,
          scheduledEndTime: guildScheduledEvent.scheduledEndTimestamp ?? null,
          entityType: guildScheduledEvent.entityType ?? null,
          status: guildScheduledEvent.status ?? null,
          userCount: guildScheduledEvent.userCount ?? null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error logging scheduled event deletion:", error);
    }
  }
);
