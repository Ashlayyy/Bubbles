import { SlashCommandBuilder } from "discord.js";

import { PermissionLevel } from "@/structures/PermissionTypes.js";
import getQueue from "../../functions/music/getQueue.js";
import Command from "../../structures/Command.js";

export default new Command(
  new SlashCommandBuilder().setName("pause").setDescription("ADMIN ONLY: Pause music."),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const guildQueue = await getQueue(interaction);
    if (!guildQueue) return;

    if (guildQueue.node.isPaused()) {
      await interaction.followUp({
        content: "Queue is already paused right now.",
      });
    } else {
      guildQueue.node.setPaused(true);
      await interaction.followUp({
        content: "Paused the music queue!",
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
