import { QueueRepeatMode } from "discord-player";
import { SlashCommandBuilder } from "discord.js";

import getQueue from "../../functions/music/getQueue.js";
import { isQueueRepeatMode, toDisplayString } from "../../functions/music/queueRepeatMode.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("repeat")
    .setDescription("ADMIN ONLY: Set the repeat mode of the music queue.")
    .addIntegerOption((option) =>
      option
        .setName("option")
        .setDescription("Repeat mode to use.")
        .setRequired(true)
        .addChoices(
          { name: "off", value: QueueRepeatMode.OFF },
          { name: "track", value: QueueRepeatMode.TRACK },
          { name: "queue", value: QueueRepeatMode.QUEUE },
          { name: "autoplay", value: QueueRepeatMode.AUTOPLAY }
        )
    ),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const guildQueue = await getQueue(interaction);
    if (!guildQueue) return;

    const repeatMode = interaction.options.getInteger("option", true);
    if (!isQueueRepeatMode(repeatMode)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new TypeError(`Invalid QueueRepeatMode value: "${repeatMode}"`);
    }

    const repeatModeDisplay = toDisplayString(repeatMode);

    // Change the repeat behavior of the queue
    if (guildQueue.repeatMode === repeatMode) {
      await interaction.followUp({
        content: `Already set to that repeat mode (${repeatModeDisplay})!`,
      });
    } else {
      guildQueue.setRepeatMode(repeatMode);
      await interaction.followUp({
        content: `Set music queue repeat mode to: ${repeatModeDisplay}!`,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
