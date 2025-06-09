import type { GuildMember } from "discord.js";
import { Colors, MessageFlags, SlashCommandBuilder, User } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("embed").setDescription("DEVELOPER ONLY: Shows a test embed."),

  async (client, interaction) => {
    const channelName = (await interaction.guild?.channels.fetch(interaction.channelId))?.name ?? "CHANNEL_NAME";

    let userDisplayName = "USER_DISPLAY_NAME";
    // Should always be true, but just in case
    if (interaction.member.user instanceof User) {
      userDisplayName = interaction.member.user.displayName;
    }

    const testEmbed = client.genEmbed({
      title: `Test embed`,
      description: `Title link points to information about embeds!`,
      url: "https://discordjs.guide/popular-topics/embeds.html",
      timestamp: interaction.createdTimestamp,
      color: Colors.DarkBlue,
      fields: [
        {
          name: "Test field name",
          value: "Test field value",
          inline: false,
        },
        {
          /** Reminder that channels, users, roles, and other links will ONLY link properly inside
           * embed field values or the embed's description
           */
          name: `Test channel field name: ${channelName}`,
          value: `Test channel field value: ${channelName}`,
          inline: false,
        },
      ],
      author: {
        name: userDisplayName,
        url: "https://ironbatman2715.github.io/",
        iconURL: (interaction.member as GuildMember).avatarURL() ?? "",
      },
      thumbnail: {
        url: "https://www.youtube.com/s/desktop/a0d4cab0/img/logos/favicon_144x144.png", //youtube icon
      },
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/U%2B2160.svg/1200px-U%2B2160.svg.png", //letter I
      },
      footer: {
        text: client.config.name,
      },
    });

    await interaction.reply({
      embeds: [testEmbed],
      flags: MessageFlags.Ephemeral,
    });
  },
  {
    permissions: {
      level: PermissionLevel.DEVELOPER,
      isConfigurable: false,
    },
  }
);
