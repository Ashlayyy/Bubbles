import { Colors, SlashCommandBuilder, User } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

class EmbedCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "embed",
      description: "DEVELOPER ONLY: Shows a test embed.",
      category: "dev",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Only bot developers (in DevCommand) are allowed; perms validated there.

    const channelName = (await this.guild.channels.fetch(this.channel.id))?.name ?? "CHANNEL_NAME";

    let userDisplayName = "USER_DISPLAY_NAME";
    if (this.member.user instanceof User) {
      userDisplayName = this.member.user.displayName;
    }

    const testEmbed = this.client.genEmbed({
      title: `Test embed`,
      description: `Title link points to information about embeds!`,
      url: "https://discordjs.guide/popular-topics/embeds.html",
      timestamp: this.interaction.createdTimestamp,
      color: Colors.DarkBlue,
      fields: [
        {
          name: "Test field name",
          value: "Test field value",
          inline: false,
        },
        {
          name: `Test channel field name: ${channelName}`,
          value: `Test channel field value: ${channelName}`,
          inline: false,
        },
      ],
      author: {
        name: userDisplayName,
        url: "https://ironbatman2715.github.io/",
        iconURL: this.member.avatarURL() ?? "",
      },
      thumbnail: {
        url: "https://www.youtube.com/s/desktop/a0d4cab0/img/logos/favicon_144x144.png",
      },
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/U%2B2160.svg/1200px-U%2B2160.svg.png",
      },
      footer: {
        text: this.client.config.name,
      },
    });

    return {
      embeds: [testEmbed],
      ephemeral: true,
    };
  }
}

export default new EmbedCommand();

export const builder = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("DEVELOPER ONLY: Shows a test embed.")
  .setDefaultMemberPermissions(0);
