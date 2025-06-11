import { SlashCommandBuilder } from "discord.js";

import getQueue from "../../functions/music/getQueue.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("stop").setDescription("ADMIN ONLY: Stops playing music."),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const guildQueue = await getQueue(interaction);
    if (!guildQueue) return;

    guildQueue.delete();
    await interaction.followUp({
      content: "Stopped the music queue!",
    });
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
