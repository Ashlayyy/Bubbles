import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ListCustomCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "custom-list",
      description: "List all custom commands in this server",
      category: "custom",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const search = this.getStringOption("search");
    const guildId = this.guild.id;

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (search) {
        params.append("search", search);
      }

      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Fetch custom commands from API
      const response = await fetch(`${customApiUrl}/api/custom-commands/${guildId}?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.success) {
        return this.createGeneralError("API Error", data.error || "Failed to fetch custom commands.");
      }

      const { commands, pagination } = data.data;

      if (commands.length === 0) {
        const embed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("📝 Custom Commands")
          .setDescription(
            search
              ? `No custom commands found matching "${search}".`
              : "No custom commands have been created in this server yet."
          )
          .setFooter({ text: "Use /custom-create to create your first custom command!" });

        return { embeds: [embed], ephemeral: false };
      }

      // Create embed with command list
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("📝 Custom Commands")
        .setDescription(search ? `Commands matching "${search}":` : "All custom commands in this server:");

      // Add command fields
      commands.forEach((command: any) => {
        const aliases =
          command.aliases && command.aliases.length > 0 ? ` (aliases: ${command.aliases.join(", ")})` : "";

        const usage = command.usageCount > 0 ? ` • Used ${command.usageCount} times` : "";

        embed.addFields({
          name: `\`${command.name}\`${aliases}`,
          value: `${command.description || "No description"}${usage}`,
          inline: true,
        });
      });

      // Add pagination info
      embed.setFooter({
        text: `Page ${pagination.currentPage} of ${pagination.totalPages} • Total: ${pagination.totalItems} commands`,
      });

      await this.logCommandUsage("custom-list", {
        page,
        search: search || null,
        commandCount: commands.length,
        totalCommands: pagination.totalItems,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error listing custom commands:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while fetching custom commands. Please try again later."
      );
    }
  }
}

export default new ListCustomCommand();

export const builder = new SlashCommandBuilder()
  .setName("custom-list")
  .setDescription("List all custom commands in this server")
  .addIntegerOption((option) => option.setName("page").setDescription("Page number (default: 1)").setMinValue(1))
  .addStringOption((option) => option.setName("search").setDescription("Search for commands containing this text"));
