import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ListAutomationCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "automation-list",
      description: "View all automation rules",
      category: "automation",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const category = this.getStringOption("category");
    const trigger = this.getStringOption("trigger");
    const enabled = this.getBooleanOption("enabled");
    const search = this.getStringOption("search");

    // Validate page number
    if (page < 1) {
      return this.createGeneralError("Invalid Page", "Page number must be greater than 0.");
    }

    try {
      const automationApiUrl = process.env.API_URL || "http://localhost:3001";

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (category) queryParams.append("category", category);
      if (trigger) queryParams.append("trigger", trigger);
      if (enabled !== null) queryParams.append("enabled", enabled?.toString() || "false");
      if (search) queryParams.append("search", search);

      // Make API request to get automation rules
      const response = await fetch(`${automationApiUrl}/api/automation/${this.guild.id}/rules?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Automation Error", result.error || "Failed to fetch automation rules");
      }

      const { rules, pagination } = result.data;

      if (!rules || rules.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("🤖 Automation Rules")
              .setDescription("No automation rules found!")
              .setColor("#ffa500")
              .addFields({
                name: "📱 Getting Started",
                value: "Create your first automation rule with `/automation-create`",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      // Format rules for display
      const rulesText = rules
        .map((rule: any, index: number) => {
          const ruleNumber = (page - 1) * 10 + index + 1;
          const statusIcon = rule.enabled ? "✅" : "❌";
          const executionText = rule.currentExecutions ? ` (${rule.currentExecutions} runs)` : "";

          return (
            `**${ruleNumber}.** ${statusIcon} **${rule.name}**\n` +
            `🔸 Trigger: ${rule.trigger}\n` +
            `🔸 Category: ${rule.category}${executionText}\n` +
            `🔸 ID: \`${rule.id}\``
          );
        })
        .join("\n\n");

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle("🤖 Automation Rules")
        .setDescription(rulesText || "No rules to display")
        .setColor("#9932cc")
        .addFields(
          {
            name: "📊 Summary",
            value:
              `**Total Rules:** ${pagination.total}\n` +
              `**Active Rules:** ${rules.filter((r: any) => r.enabled).length}\n` +
              `**Categories:** ${new Set(rules.map((r: any) => r.category)).size}`,
            inline: true,
          },
          {
            name: "🔧 Management",
            value:
              "• `/automation-create` - Create new rule\n" +
              "• `/automation-edit` - Edit existing rule\n" +
              "• `/automation-delete` - Delete rule\n" +
              "• `/automation-toggle` - Enable/disable rule",
            inline: true,
          }
        )
        .setFooter({
          text: `Page ${pagination.page}/${pagination.pages} • Total: ${pagination.total} rules`,
          iconURL: this.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Add filter info if filters are applied
      const activeFilters: string[] = [];
      if (category) activeFilters.push(`Category: ${category}`);
      if (trigger) activeFilters.push(`Trigger: ${trigger}`);
      if (enabled !== null) activeFilters.push(`Status: ${enabled ? "Enabled" : "Disabled"}`);
      if (search) activeFilters.push(`Search: "${search}"`);

      if (activeFilters.length > 0) {
        embed.addFields({
          name: "🔍 Active Filters",
          value: activeFilters.join(" • "),
          inline: false,
        });
      }

      await this.logCommandUsage("automation-list", {
        page,
        totalRules: pagination.total,
        activeFilters: activeFilters.length,
        filters: { category, trigger, enabled, search },
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing automation-list command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching automation rules. Please try again.");
    }
  }
}

export default new ListAutomationCommand();

export const builder = new SlashCommandBuilder()
  .setName("automation-list")
  .setDescription("View all automation rules")
  .setDefaultMemberPermissions("0")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("Page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("Filter by category")
      .setRequired(false)
      .addChoices(
        { name: "General", value: "general" },
        { name: "Moderation", value: "moderation" },
        { name: "Welcome", value: "welcome" },
        { name: "Roles", value: "roles" },
        { name: "Logging", value: "logging" },
        { name: "Voice", value: "voice" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("trigger")
      .setDescription("Filter by trigger type")
      .setRequired(false)
      .addChoices(
        { name: "Member Join", value: "member_join" },
        { name: "Member Leave", value: "member_leave" },
        { name: "Message Delete", value: "message_delete" },
        { name: "Role Add", value: "role_add" },
        { name: "Role Remove", value: "role_remove" },
        { name: "Channel Create", value: "channel_create" },
        { name: "Voice Join", value: "voice_join" },
        { name: "Voice Leave", value: "voice_leave" },
        { name: "Scheduled", value: "scheduled" }
      )
  )
  .addBooleanOption((option) => option.setName("enabled").setDescription("Filter by enabled status").setRequired(false))
  .addStringOption((option) =>
    option.setName("search").setDescription("Search rules by name or description").setRequired(false).setMaxLength(100)
  );
