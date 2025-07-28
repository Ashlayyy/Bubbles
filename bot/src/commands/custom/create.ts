import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class CreateCustomCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "custom-create",
      description: "Create a new custom command",
      category: "custom",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true);
    const content = this.getStringOption("content", true);
    const description = this.getStringOption("description");
    const category = this.getStringOption("category") || "general";
    const cooldown = this.getIntegerOption("cooldown") || 0;
    const aliases = this.getStringOption("aliases");

    try {
      // Validate command name
      if (name.length < 2 || name.length > 32) {
        return this.createGeneralError("Invalid Name", "Command name must be between 2 and 32 characters long.");
      }

      // Validate content length
      if (content.length > 2000) {
        return this.createGeneralError("Content Too Long", "Command content must be 2000 characters or less.");
      }

      // Validate cooldown
      if (cooldown < 0 || cooldown > 3600) {
        return this.createGeneralError("Invalid Cooldown", "Cooldown must be between 0 and 3600 seconds (1 hour).");
      }

      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Parse aliases
      const aliasArray = aliases
        ? aliases
            .split(",")
            .map((alias) => alias.trim().toLowerCase())
            .filter((alias) => alias.length > 0)
        : [];

      // Prepare command data
      const commandData = {
        name: name.toLowerCase(),
        content,
        description: description || null,
        category,
        cooldownSeconds: cooldown,
        aliases: aliasArray,
        enabled: true,
      };

      // Make API request to create custom command
      const response = await fetch(`${customApiUrl}/api/custom-commands/${this.guild.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Command Creation Error", result.error || "Failed to create custom command");
      }

      const command = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("✅ Custom Command Created")
        .setDescription(`Successfully created custom command: **${command.name}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "📛 Command Name",
            value: `\`${command.name}\``,
            inline: true,
          },
          {
            name: "📂 Category",
            value: command.category,
            inline: true,
          },
          {
            name: "⏰ Cooldown",
            value: `${command.cooldownSeconds} seconds`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add description if provided
      if (command.description) {
        embed.addFields({
          name: "📋 Description",
          value: command.description,
          inline: false,
        });
      }

      // Add content preview
      const contentPreview = command.content.length > 200 ? command.content.substring(0, 197) + "..." : command.content;

      embed.addFields({
        name: "📝 Content",
        value: `\`\`\`${contentPreview}\`\`\``,
        inline: false,
      });

      // Add aliases if any
      if (command.aliases && command.aliases.length > 0) {
        embed.addFields({
          name: "🔗 Aliases",
          value: command.aliases.map((alias: string) => `\`${alias}\``).join(", "),
          inline: false,
        });
      }

      embed.addFields(
        {
          name: "🆔 Command ID",
          value: `\`${command.id}\``,
          inline: true,
        },
        {
          name: "📊 Status",
          value: command.enabled ? "🟢 Enabled" : "🔴 Disabled",
          inline: true,
        },
        {
          name: "📱 Usage",
          value: `Use \`/${command.name}\` to execute this command!`,
          inline: false,
        },
        {
          name: "🔧 Management",
          value:
            "• Use `/custom-list` to see all custom commands\n" +
            "• Use `/custom-edit` to modify this command\n" +
            "• Use `/custom-delete` to remove this command\n" +
            "• Use `/custom-info` to view detailed information",
          inline: false,
        }
      );

      await this.logCommandUsage("custom-create", {
        commandId: command.id,
        commandName: command.name,
        category: command.category,
        cooldownSeconds: command.cooldownSeconds,
        aliasCount: command.aliases?.length || 0,
        contentLength: command.content.length,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing custom-create command:", error);
      return this.createGeneralError("Error", "An error occurred while creating the custom command. Please try again.");
    }
  }
}

export default new CreateCustomCommand();

export const builder = new SlashCommandBuilder()
  .setName("custom-create")
  .setDescription("Create a new custom command")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Name of the custom command (2-32 characters)")
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(32)
  )
  .addStringOption((option) =>
    option.setName("content").setDescription("Content/response of the command").setRequired(true).setMaxLength(2000)
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("Description of what the command does")
      .setRequired(false)
      .setMaxLength(200)
  )
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("Category for the command (default: general)")
      .setRequired(false)
      .addChoices(
        { name: "General", value: "general" },
        { name: "Fun", value: "fun" },
        { name: "Utility", value: "utility" },
        { name: "Information", value: "info" },
        { name: "Moderation", value: "moderation" }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("cooldown")
      .setDescription("Cooldown in seconds (0-3600)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(3600)
  )
  .addStringOption((option) =>
    option
      .setName("aliases")
      .setDescription("Alternative names for the command (comma-separated)")
      .setRequired(false)
      .setMaxLength(200)
  );
