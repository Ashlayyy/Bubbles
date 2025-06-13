import type { Sticker } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildStickerDelete, async (sticker: Sticker) => {
  // Only process guild stickers
  if (!sticker.guild) return;

  const client = sticker.client as import("../../structures/Client.js").default;

  // Log the sticker deletion
  await client.logManager.log(sticker.guild.id, "STICKER_DELETE", {
    metadata: {
      stickerId: sticker.id,
      stickerName: sticker.name,
      stickerDescription: sticker.description,
      stickerTags: sticker.tags,
      stickerFormat: sticker.format,
      stickerType: sticker.type,
      stickerURL: sticker.url,
      available: sticker.available,
      guildId: sticker.guildId,
      timestamp: new Date().toISOString(),
    },
  });
});
