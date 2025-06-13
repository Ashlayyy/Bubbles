import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildScheduledEventUserAdd, async (guildScheduledEvent, user) => {
  if (!guildScheduledEvent.guild) return;

  const client = guildScheduledEvent.client as import("../../structures/Client.js").default;

  // Log when a user subscribes to a scheduled event
  await client.logManager.log(guildScheduledEvent.guild.id, "SCHEDULED_EVENT_USER_ADD", {
    executorId: user.id,
    metadata: {
      eventId: guildScheduledEvent.id,
      eventName: guildScheduledEvent.name,
      userId: user.id,
      username: user.username,
      userCount: guildScheduledEvent.userCount,
      timestamp: new Date().toISOString(),
    },
  });
});
