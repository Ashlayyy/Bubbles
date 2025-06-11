import type { GuildScheduledEvent, PartialGuildScheduledEvent } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.GuildScheduledEventUpdate,
  async (
    oldGuildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    newGuildScheduledEvent: GuildScheduledEvent
  ) => {
    if (!newGuildScheduledEvent.guild) return;

    const client = newGuildScheduledEvent.client as import("../../structures/Client.js").default;

    // Compare scheduled event changes
    const changes: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (oldGuildScheduledEvent) {
      // Check for name changes
      if (oldGuildScheduledEvent.name !== newGuildScheduledEvent.name) {
        changes.push("name");
        before.name = oldGuildScheduledEvent.name;
        after.name = newGuildScheduledEvent.name;
      }

      // Check for description changes (handle null values for partial events)
      if (oldGuildScheduledEvent.description !== newGuildScheduledEvent.description) {
        changes.push("description");
        before.description = oldGuildScheduledEvent.description;
        after.description = newGuildScheduledEvent.description;
      }

      // Check for status changes
      if (oldGuildScheduledEvent.status !== newGuildScheduledEvent.status) {
        changes.push("status");
        before.status = oldGuildScheduledEvent.status;
        after.status = newGuildScheduledEvent.status;
      }

      // Check for time changes
      if (oldGuildScheduledEvent.scheduledStartAt?.getTime() !== newGuildScheduledEvent.scheduledStartAt?.getTime()) {
        changes.push("scheduledStartAt");
        before.scheduledStartAt = oldGuildScheduledEvent.scheduledStartAt?.toISOString();
        after.scheduledStartAt = newGuildScheduledEvent.scheduledStartAt?.toISOString();
      }

      if (oldGuildScheduledEvent.scheduledEndAt?.getTime() !== newGuildScheduledEvent.scheduledEndAt?.getTime()) {
        changes.push("scheduledEndAt");
        before.scheduledEndAt = oldGuildScheduledEvent.scheduledEndAt?.toISOString();
        after.scheduledEndAt = newGuildScheduledEvent.scheduledEndAt?.toISOString();
      }
    }

    // Log the scheduled event update if there are changes
    if (changes.length > 0) {
      await client.logManager.log(newGuildScheduledEvent.guild.id, "SCHEDULED_EVENT_UPDATE", {
        executorId: newGuildScheduledEvent.creatorId ?? undefined,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        metadata: {
          eventId: newGuildScheduledEvent.id,
          eventName: newGuildScheduledEvent.name,
          changes,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);
