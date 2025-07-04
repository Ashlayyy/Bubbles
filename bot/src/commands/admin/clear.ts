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
      return this.createAdminError(
        "Invalid Quantity",
        `❌ Cannot clear **${String(quantity)}** messages!\n\n` +
          `**Allowed range:** 1 to ${String(maxMessagesCleared)} messages\n` +
          `**Tip:** Server admins can adjust this limit in \`/config\``
      );
    }

    const channel = this.interaction.channel as TextChannel;

    try {
      // Show loading indicator for large operations
      if (quantity > 50) {
        await this.interaction.deferReply({ ephemeral: true });
      }

      const messagesToDelete = await channel.messages.fetch({
        limit: quantity,
        before: this.interaction.id,
      });

      const actualCount = messagesToDelete.size;

      if (actualCount === 0) {
        return this.createAdminError("No Messages Found", "❌ No messages found to delete in this channel.");
      }

      // Note: 2nd argument in bulkDelete filters out messages +2 weeks old
      const deletedMessages = await channel.bulkDelete(messagesToDelete, true);
      const deletedCount = deletedMessages.size;

      // Log the clear action
      await this.client.logManager.log(this.guild.id, "MESSAGE_BULK_DELETE", {
        channelId: channel.id,
        executorId: this.user.id,
        metadata: {
          requestedCount: quantity,
          actuallyDeleted: deletedCount,
          method: "clear_command",
        },
      });

      // Success message with embed
      return this.createAdminSuccess(
        "Messages Cleared",
        `🧹 Successfully cleared **${String(deletedCount)}** message${deletedCount === 1 ? "" : "s"}` +
          (deletedCount < quantity ? `\n\n*Note: Some messages may have been too old to delete (>14 days)*` : "")
      );
    } catch (err) {
      logger.error("Error while trying to bulkDelete messages", err);

      return this.createAdminError(
        "Deletion Failed",
        "❌ Failed to delete messages. This usually happens when:\n\n" +
          "• **Messages are older than 14 days** (Discord limitation)\n" +
          "• **Insufficient permissions** to delete messages\n" +
          "• **Too many messages** requested at once\n\n" +
          "💡 **Tip:** Try reducing the number of messages or check bot permissions."
      );
    }
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
