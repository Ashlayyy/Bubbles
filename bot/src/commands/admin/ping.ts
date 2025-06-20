import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows the ping of the bot.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async (client, interaction) => {
    const pingStr = `Ping => \`${client.ws.ping.toString()} ms\`\n`;

    await interaction.reply({
      content: pingStr,
      ephemeral: true,
    });
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
