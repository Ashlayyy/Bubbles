import type { GuildScheduledEvent } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildScheduledEventCreate, async (guildScheduledEvent: GuildScheduledEvent) => {
  if (!guildScheduledEvent.guild) return;

  const client = guildScheduledEvent.client as import("../../structures/Client.js").default;

  // Log the scheduled event creation
  await client.logManager.log(guildScheduledEvent.guild.id, "SCHEDULED_EVENT_CREATE", {
    executorId: guildScheduledEvent.creatorId ?? undefined,
    metadata: {
      eventId: guildScheduledEvent.id,
      eventName: guildScheduledEvent.name,
      eventDescription: guildScheduledEvent.description,
      channelId: guildScheduledEvent.channelId,
      entityType: guildScheduledEvent.entityType,
      entityMetadata: guildScheduledEvent.entityMetadata ? JSON.stringify(guildScheduledEvent.entityMetadata) : null,
      scheduledStartAt: guildScheduledEvent.scheduledStartAt?.toISOString(),
      scheduledEndAt: guildScheduledEvent.scheduledEndAt?.toISOString(),
      privacyLevel: guildScheduledEvent.privacyLevel,
      status: guildScheduledEvent.status,
      userCount: guildScheduledEvent.userCount,
      creatorId: guildScheduledEvent.creatorId,
      image: guildScheduledEvent.image,
      url: guildScheduledEvent.url,
      timestamp: new Date().toISOString(),
    },
  });
});
