import type { TextChannel } from "discord.js";
import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import { isInRange } from "../../functions/general/math.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Clear Command - Clear messages from the text channel
 */
export class ClearCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "clear",
      description: "ADMIN ONLY: Clear messages from the text channel! (Cannot clear older than 2 weeks)",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        discordPermissions: [PermissionsBitField.Flags.ManageMessages],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const quantity = this.getIntegerOption("quantity", true);
    const { maxMessagesCleared } = await getGuildConfig(this.guild.id);

    // Check if desired number is within allowed range
    if (!isInRange(quantity, 1, maxMessagesCleared)) {
      return {
        content: `You can not clear ${quantity} messages! Allowed range is from 1 to ${maxMessagesCleared}.`,
        ephemeral: true,
      };
    }

    const channel = this.interaction.channel as TextChannel;

    const messagesToDelete = await channel.messages.fetch({
      limit: quantity,
      before: this.interaction.id,
    });

    try {
      // Note: 2nd argument in bulkDelete filters out messages +2 weeks old, as they cannot be deleted via bulkDelete
      await channel.bulkDelete(messagesToDelete, true);
    } catch (err) {
      logger.error("Errored while trying to bulkDelete messages", err);

      return {
        content: `Errored while trying to bulkDelete messages! Make sure you are not 
        (1) deleting more than are in the channel or (2) trying to delete messages made +2 weeks ago.`,
        ephemeral: true,
      };
    }

    // Confirmation message
    return {
      content: `Cleared \`${quantity}\` message${quantity === 1 ? "" : "s"}`,
      ephemeral: true,
    };
  }
}

// Export the command instance
export default new ClearCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("ADMIN ONLY: Clear messages from the text channel! (Cannot clear older than 2 weeks)")
  .addIntegerOption((option) =>
    option.setName("quantity").setDescription("Number of messages to delete").setRequired(true).setMinValue(1)
  );
