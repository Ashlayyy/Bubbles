import type { ForumChannel, MediaChannel, NewsChannel, StageChannel, TextChannel, VoiceChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.WebhooksUpdate,
  async (channel: TextChannel | NewsChannel | VoiceChannel | StageChannel | ForumChannel | MediaChannel) => {
    const client = channel.client as import("../../structures/Client.js").default;

    // Log the webhook update
    await client.logManager.log(channel.guild.id, "WEBHOOKS_UPDATE", {
      channelId: channel.id,
      metadata: {
        channelName: channel.name,
        channelId: channel.id,
        channelType: channel.type,
        timestamp: new Date().toISOString(),
      },
    });
  }
);
