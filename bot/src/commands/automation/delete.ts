import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class DeleteAutomationCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "automation-delete",
      description: "Delete an automation rule",
      category: "automation",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const ruleId = this.getStringOption("rule-id", true);
    const confirm = this.getBooleanOption("confirm") ?? false;

    if (!confirm) {
      return this.createGeneralError(
        "Confirmation Required",
        "You must set `confirm` to `true` to delete an automation rule. This action cannot be undone!"
      );
    }

    try {
      const automationApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get the rule details for the confirmation message
      const getResponse = await fetch(`${automationApiUrl}/api/automation/${this.guild.id}/rules/${ruleId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return this.createGeneralError("Rule Not Found", "The specified automation rule was not found.");
        }
        throw new Error(`API request failed: ${getResponse.status}`);
      }

      const getRuleResult = (await getResponse.json()) as any;

      if (!getRuleResult.success) {
        return this.createGeneralError("Error", getRuleResult.error || "Failed to fetch automation rule details");
      }

      const rule = getRuleResult.data;

      // Now delete the rule
      const deleteResponse = await fetch(`${automationApiUrl}/api/automation/${this.guild.id}/rules/${ruleId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          requestedBy: this.user.id,
          requestedByName: this.user.username,
        }),
      });

      if (!deleteResponse.ok) {
        throw new Error(`API request failed: ${deleteResponse.status}`);
      }

      const deleteResult = (await deleteResponse.json()) as any;

      if (!deleteResult.success) {
        return this.createGeneralError("Deletion Error", deleteResult.error || "Failed to delete automation rule");
      }

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Automation Rule Deleted")
        .setDescription(`Successfully deleted automation rule: **${rule.name}**`)
        .setColor("#ff0000")
        .addFields(
          {
            name: "📝 Deleted Rule",
            value: rule.name,
            inline: true,
          },
          {
            name: "⚡ Trigger",
            value: rule.trigger,
            inline: true,
          },
          {
            name: "🎯 Category",
            value: rule.category || "general",
            inline: true,
          },
          {
            name: "📊 Statistics",
            value:
              `**Total Executions:** ${rule.currentExecutions || 0}\n` +
              `**Last Executed:** ${rule.lastExecuted ? new Date(rule.lastExecuted).toLocaleString() : "Never"}`,
            inline: false,
          },
          {
            name: "👤 Deleted by",
            value: this.formatUserDisplay(this.user),
            inline: true,
          },
          {
            name: "⚠️ Important",
            value:
              "This action cannot be undone. The rule and all its execution history have been permanently removed.",
            inline: false,
          },
          {
            name: "📱 Next Steps",
            value:
              "• Use `/automation-list` to view remaining rules\n" + "• Use `/automation-create` to create a new rule",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Deleted by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      await this.logCommandUsage("automation-delete", {
        ruleId,
        ruleName: rule.name,
        trigger: rule.trigger,
        category: rule.category,
        executionCount: rule.currentExecutions || 0,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing automation-delete command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while deleting the automation rule. Please try again."
      );
    }
  }
}

export default new DeleteAutomationCommand();

export const builder = new SlashCommandBuilder()
  .setName("automation-delete")
  .setDescription("Delete an automation rule")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option.setName("rule-id").setDescription("ID of the automation rule to delete").setRequired(true)
  )
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to delete this rule (required)").setRequired(true)
  );
