import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class EditCustomCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "custom-edit",
      description: "Edit an existing custom command",
      category: "custom",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true);
    const content = this.getStringOption("content");
    const description = this.getStringOption("description");
    const category = this.getStringOption("category");
    const cooldown = this.getIntegerOption("cooldown");
    const aliases = this.getStringOption("aliases");
    const enabled = this.getBooleanOption("enabled");
    const guildId = this.guild.id;

    try {
      // Validate inputs if provided
      if (content && content.length > 2000) {
        return this.createGeneralError("Content Too Long", "Command content must be 2000 characters or less.");
      }

      if (cooldown !== null && (cooldown < 0 || cooldown > 3600)) {
        return this.createGeneralError("Invalid Cooldown", "Cooldown must be between 0 and 3600 seconds (1 hour).");
      }

      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Parse aliases if provided
      let aliasArray: string[] | undefined;
      if (aliases !== null) {
        aliasArray = aliases
          ? aliases
              .split(",")
              .map((alias) => alias.trim().toLowerCase())
              .filter((alias) => alias.length > 0)
          : [];
      }

      // Prepare update data (only include fields that were provided)
      const updateData: any = {};
      if (content !== null) updateData.content = content;
      if (description !== null) updateData.description = description;
      if (category !== null) updateData.category = category;
      if (cooldown !== null) updateData.cooldownSeconds = cooldown;
      if (aliases !== null) updateData.aliases = aliasArray;
      if (enabled !== null) updateData.enabled = enabled;

      if (Object.keys(updateData).length === 0) {
        return this.createGeneralError("No Changes", "You must provide at least one field to update.");
      }

      // Make API request to update custom command
      const response = await fetch(`${customApiUrl}/api/custom-commands/${guildId}/${name.toLowerCase()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify(updateData),
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
        return this.createGeneralError("Update Error", result.error || "Failed to update custom command");
      }

      const command = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("✅ Custom Command Updated")
        .setDescription(`Successfully updated custom command: **${command.name}**`)
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
          text: `Updated by ${this.user.username}`,
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
      const contentPreview =
        (command.content as string).length > 200
          ? (command.content as string).substring(0, 197) + "..."
          : (command.content as string);

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
        }
      );

      // Show what was changed
      const changes: string[] = [];
      if (content !== null) changes.push("📝 Content");
      if (description !== null) changes.push("📋 Description");
      if (category !== null) changes.push("📂 Category");
      if (cooldown !== null) changes.push("⏰ Cooldown");
      if (aliases !== null) changes.push("🔗 Aliases");
      if (enabled !== null) changes.push("📊 Status");

      if (changes.length > 0) {
        embed.addFields({
          name: "🔄 Changes Made",
          value: changes.join(", "),
          inline: false,
        });
      }

      await this.logCommandUsage("custom-edit", {
        commandId: command.id,
        commandName: command.name,
        changesMade: changes,
        fieldsUpdated: Object.keys(updateData),
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing custom-edit command:", error);
      return this.createGeneralError("Error", "An error occurred while updating the custom command. Please try again.");
    }
  }
}

export default new EditCustomCommand();

export const builder = new SlashCommandBuilder()
  .setName("custom-edit")
  .setDescription("Edit an existing custom command")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Name of the custom command to edit")
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(32)
  )
  .addStringOption((option) =>
    option.setName("content").setDescription("New content/response of the command").setMaxLength(2000)
  )
  .addStringOption((option) =>
    option.setName("description").setDescription("New description for the command").setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName("category").setDescription("New category for the command").setMaxLength(50)
  )
  .addIntegerOption((option) =>
    option.setName("cooldown").setDescription("New cooldown in seconds (0-3600)").setMinValue(0).setMaxValue(3600)
  )
  .addStringOption((option) =>
    option
      .setName("aliases")
      .setDescription("New aliases (comma-separated, leave empty to remove all)")
      .setMaxLength(200)
  )
  .addBooleanOption((option) =>
    option.setName("enabled").setDescription("Whether the command should be enabled or disabled")
  );
