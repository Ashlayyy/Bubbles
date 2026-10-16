import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class DeleteCustomCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "custom-delete",
      description: "Delete an existing custom command",
      category: "custom",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true);
    const confirm = this.getBooleanOption("confirm") || false;
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // If not confirmed, show warning first
      if (!confirm) {
        const embed = new EmbedBuilder()
          .setTitle("⚠️ Confirm Command Deletion")
          .setDescription(`Are you sure you want to delete the custom command: **${name}**?`)
          .setColor("#ff9900")
          .addFields(
            {
              name: "🚨 Warning",
              value: "This action cannot be undone. The command and all its data will be permanently deleted.",
              inline: false,
            },
            {
              name: "📋 To Confirm",
              value: `Run this command again with the \`confirm\` option set to \`true\`:\n\`/custom-delete name:${name} confirm:true\``,
              inline: false,
            }
          )
          .setFooter({
            text: `Requested by ${this.user.username}`,
            iconURL: this.user.displayAvatarURL(),
          });

        return { embeds: [embed], ephemeral: false };
      }

      // Get command info first to show in the success message
      const getResponse = await fetch(`${customApiUrl}/api/custom-commands/${guildId}/${name.toLowerCase()}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return this.createGeneralError(
            "Command Not Found",
            `No custom command named "${name}" exists in this server.`
          );
        }
        throw new Error(`API request failed: ${getResponse.status}`);
      }

      const getResult = (await getResponse.json()) as any;
      if (!getResult.success) {
        return this.createGeneralError("API Error", getResult.error || "Failed to fetch command information");
      }

      const commandToDelete = getResult.data;

      // Make API request to delete custom command
      const response = await fetch(`${customApiUrl}/api/custom-commands/${guildId}/${name.toLowerCase()}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createGeneralError(
            "Command Not Found",
            `No custom command named "${name}" exists in this server.`
          );
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Delete Error", result.error || "Failed to delete custom command");
      }

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Custom Command Deleted")
        .setDescription(`Successfully deleted custom command: **${commandToDelete.name}**`)
        .setColor("#ff0000")
        .addFields(
          {
            name: "📛 Command Name",
            value: `\`${commandToDelete.name}\``,
            inline: true,
          },
          {
            name: "📂 Category",
            value: commandToDelete.category || "general",
            inline: true,
          },
          {
            name: "📊 Usage Count",
            value: `${commandToDelete.usageCount || 0} times`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Deleted by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add description if it existed
      if (commandToDelete.description) {
        embed.addFields({
          name: "📋 Description",
          value: commandToDelete.description,
          inline: false,
        });
      }

      // Add aliases if any existed
      if (commandToDelete.aliases && commandToDelete.aliases.length > 0) {
        embed.addFields({
          name: "🔗 Aliases",
          value: commandToDelete.aliases.map((alias: string) => `\`${alias}\``).join(", "),
          inline: false,
        });
      }

      // Add content preview of what was deleted
      if (commandToDelete.content) {
        const contentPreview =
          (commandToDelete.content as string).length > 200
            ? (commandToDelete.content as string).substring(0, 197) + "..."
            : (commandToDelete.content as string);

        embed.addFields({
          name: "📝 Deleted Content",
          value: `\`\`\`${contentPreview}\`\`\``,
          inline: false,
        });
      }

      embed.addFields({
        name: "✅ Completed",
        value: "The custom command has been permanently removed from this server.",
        inline: false,
      });

      await this.logCommandUsage("custom-delete", {
        commandId: commandToDelete.id,
        commandName: commandToDelete.name,
        category: commandToDelete.category || "general",
        usageCount: commandToDelete.usageCount || 0,
        hadAliases: commandToDelete.aliases?.length > 0,
        aliasCount: commandToDelete.aliases?.length || 0,
        contentLength: commandToDelete.content?.length || 0,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing custom-delete command:", error);
      return this.createGeneralError("Error", "An error occurred while deleting the custom command. Please try again.");
    }
  }
}

export default new DeleteCustomCommand();

export const builder = new SlashCommandBuilder()
  .setName("custom-delete")
  .setDescription("Delete an existing custom command")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Name of the custom command to delete")
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(32)
  )
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to delete this command (required for deletion)")
  );
