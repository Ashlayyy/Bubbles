import { ChannelType, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { ComplimentWheelService } from "../../services/complimentWheelService.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

export class ComplimentCommand extends GeneralCommand {
  constructor() {
    super({
      name: "compliment",
      description: "Manage the compliment wheel system",
      category: "admin",
      permissions: { level: PermissionLevel.ADMIN },
      guildOnly: true,
      ephemeral: true,
    });
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = (this.interaction.options as any).getSubcommand();

    try {
      switch (subcommand) {
        case "reset":
          return await this.handleReset();
        case "test":
          return await this.handleTest();
        case "delete":
          return await this.handleDelete();
        default:
          return {
            content: "❌ Unknown subcommand. Use `/setup complimenten` to configure the system.",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in compliment command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleReset(): Promise<CommandResponse> {
    // Check if user has manage guild permissions
    if (!this.member.permissions.has("ManageGuild")) {
      return {
        content: "❌ You need the 'Manage Server' permission to reset the compliment wheel.",
        ephemeral: true,
      };
    }

    try {
      const wheelService = ComplimentWheelService.getInstance(this.client);

      // Check if wheel exists
      const config = await wheelService.getWheelConfig(this.guild.id);
      if (!config) {
        return {
          content: "❌ No compliment wheel is set up for this server. Use `/compliment setup` to create one.",
          ephemeral: true,
        };
      }

      // Reset the wheel
      await wheelService.resetWheel(this.guild.id);

      const embed = new EmbedBuilder()
        .setTitle("🔄 Compliment Wheel Reset!")
        .setColor("#ffa500")
        .setDescription("The compliment wheel has been reset! All previously drawn users are back in the wheel.")
        .addFields({
          name: "📊 Current Status",
          value:
            "• All users are back in the wheel\n• A new cycle has started\n• Daily drawings will continue as normal",
        })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error resetting compliment wheel:", error);
      return {
        content: "❌ Failed to reset the compliment wheel. Please try again.",
        ephemeral: true,
      };
    }
  }

  private async handleTest(): Promise<CommandResponse> {
    // Check if user has manage guild permissions
    if (!this.member.permissions.has("ManageGuild")) {
      return {
        content: "❌ You need the 'Manage Server' permission to test the compliment wheel.",
        ephemeral: true,
      };
    }

    try {
      const wheelService = ComplimentWheelService.getInstance(this.client);

      // Check if wheel exists
      const config = await wheelService.getWheelConfig(this.guild.id);
      if (!config) {
        return {
          content: "❌ No compliment wheel is set up for this server. Use `/compliment setup` to create one.",
          ephemeral: true,
        };
      }

      // Perform an instant test round
      const result = await wheelService.performTestRound(this.guild.id);

      if (!result) {
        return {
          content: "❌ No users have reacted to the message yet. Please wait for users to react with the emoji.",
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setTitle("🧪 Compliment Wheel Test Complete!")
        .setColor("#00bfff")
        .setDescription("A test round of the compliment wheel has been completed!")
        .addFields(
          {
            name: "🎉 Winner",
            value: `<@${result.winnerId}>`,
            inline: true,
          },
          {
            name: "📊 Participants",
            value: `${result.participantCount} users`,
            inline: true,
          },
          {
            name: "📢 Sent to",
            value: `<#${config.complimentChannelId}>`,
            inline: true,
          }
        )
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error testing compliment wheel:", error);
      return {
        content: "❌ Failed to test the compliment wheel. Please try again.",
        ephemeral: true,
      };
    }
  }

  private async handleDelete(): Promise<CommandResponse> {
    // Check if user has manage guild permissions
    if (!this.member.permissions.has("ManageGuild")) {
      return {
        content: "❌ You need the 'Manage Server' permission to delete the compliment wheel.",
        ephemeral: true,
      };
    }

    try {
      const wheelService = ComplimentWheelService.getInstance(this.client);

      // Check if wheel exists
      const config = await wheelService.getWheelConfig(this.guild.id);
      if (!config) {
        return {
          content: "❌ No compliment wheel is set up for this server.",
          ephemeral: true,
        };
      }

      // Delete the wheel configuration from DB
      await wheelService.deleteWheel(this.guild.id);

      const embed = new EmbedBuilder()
        .setTitle("🗑️ Compliment Wheel Deleted!")
        .setColor("#ff0000")
        .setDescription("The compliment wheel has been completely removed from this server.")
        .addFields({
          name: "📊 What was removed",
          value: "• Wheel configuration\n• All participant data\n• Scheduled daily drawings\n• Database entries",
        })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error deleting compliment wheel:", error);
      return {
        content: "❌ Failed to delete the compliment wheel. Please try again.",
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new ComplimentCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("compliment")
  .setDescription("Manage the compliment wheel system")
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set up the compliment wheel")
      .addStringOption((opt) =>
        opt.setName("message_id").setDescription("ID of the message to monitor for reactions").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel where the message to monitor is located")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("compliment_channel")
          .setDescription("Channel where daily compliments will be sent")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("emoji").setDescription("Emoji to monitor for reactions (e.g., ❤️, 👍, 🎉)").setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName("reset").setDescription("Reset the compliment wheel and start a new cycle"))
  .addSubcommand((sub) => sub.setName("test").setDescription("Perform an instant test round of the compliment wheel"))
  .addSubcommand((sub) =>
    sub.setName("delete").setDescription("Completely delete the compliment wheel from this server")
  );
