import type { TextBasedChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ChannelPinsUpdate, async (channel: TextBasedChannel, time: Date) => {
  // Only process guild channels
  if (!("guild" in channel)) return;

  const client = channel.client as import("../../structures/Client.js").default;

  try {
    await client.logManager.log(channel.guild.id, "CHANNEL_PINS_UPDATE", {
      channelId: channel.id,
      metadata: {
        channelName: "name" in channel ? channel.name : "Unknown",
        channelType: channel.type,
        lastPinTimestamp: time.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error logging channel pins update:", error);
  }
});
