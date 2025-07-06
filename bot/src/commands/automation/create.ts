import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class CreateAutomationCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "automation-create",
      description: "Create a new automation rule",
      category: "automation",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true);
    const trigger = this.getStringOption("trigger", true);
    const action = this.getStringOption("action", true);
    const description = this.getStringOption("description") || "";
    const category = this.getStringOption("category") || "general";
    const enabled = this.getBooleanOption("enabled") ?? true;

    try {
      const automationApiUrl = process.env.API_URL || "http://localhost:3001";

      // Prepare automation rule data
      const automationData = {
        name,
        description,
        category,
        trigger,
        conditions: [], // Basic implementation - could be enhanced with condition parsing
        actions: [
          {
            type: action,
            parameters: {
              // Basic action parameters - could be enhanced based on action type
              message: this.getStringOption("message") || "Automation triggered",
            },
          },
        ],
        enabled,
        priority: this.getIntegerOption("priority") || 0,
        cooldownSeconds: this.getIntegerOption("cooldown") || 0,
        maxExecutions: this.getIntegerOption("max-executions") || null,
      };

      // Make API request to create automation rule
      const response = await fetch(`${automationApiUrl}/api/automation/${this.guild.id}/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify(automationData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Automation Error", result.error || "Failed to create automation rule");
      }

      const rule = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🤖 Automation Rule Created")
        .setDescription(`Successfully created automation rule: **${rule.name}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "📝 Rule Name",
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
            name: "📋 Description",
            value: rule.description || "No description provided",
            inline: false,
          },
          {
            name: "🔧 Actions",
            value: rule.actions.map((action: any) => `• ${action.type}`).join("\n") || "No actions",
            inline: true,
          },
          {
            name: "⚙️ Settings",
            value:
              `**Status:** ${rule.enabled ? "✅ Enabled" : "❌ Disabled"}\n` +
              `**Priority:** ${rule.priority || 0}\n` +
              `**Cooldown:** ${rule.cooldownSeconds || 0}s`,
            inline: true,
          },
          {
            name: "🆔 Rule ID",
            value: `\`${rule.id}\``,
            inline: false,
          },
          {
            name: "📱 Management",
            value:
              "Use `/automation-list` to view all rules\n" +
              "Use `/automation-edit` to modify this rule\n" +
              "Use `/automation-delete` to remove this rule",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      await this.logCommandUsage("automation-create", {
        ruleName: rule.name,
        trigger: rule.trigger,
        category: rule.category,
        enabled: rule.enabled,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing automation-create command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while creating the automation rule. Please try again."
      );
    }
  }
}

export default new CreateAutomationCommand();

export const builder = new SlashCommandBuilder()
  .setName("automation-create")
  .setDescription("Create a new automation rule")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option.setName("name").setDescription("Name for the automation rule").setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName("trigger")
      .setDescription("Event that triggers the automation")
      .setRequired(true)
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
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform when triggered")
      .setRequired(true)
      .addChoices(
        { name: "Send Message", value: "send_message" },
        { name: "Add Role", value: "add_role" },
        { name: "Remove Role", value: "remove_role" },
        { name: "Kick Member", value: "kick_member" },
        { name: "Ban Member", value: "ban_member" },
        { name: "Create Channel", value: "create_channel" },
        { name: "Delete Channel", value: "delete_channel" },
        { name: "Log Event", value: "log_event" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("Description of what this automation does")
      .setRequired(false)
      .setMaxLength(500)
  )
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("Category for organizing automation rules")
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
      .setName("message")
      .setDescription("Message to send (for send_message action)")
      .setRequired(false)
      .setMaxLength(2000)
  )
  .addBooleanOption((option) =>
    option.setName("enabled").setDescription("Whether the automation rule is enabled").setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("priority")
      .setDescription("Priority level (higher numbers execute first)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption((option) =>
    option
      .setName("cooldown")
      .setDescription("Cooldown in seconds between executions")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(86400)
  )
  .addIntegerOption((option) =>
    option
      .setName("max-executions")
      .setDescription("Maximum number of times this rule can execute")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10000)
  );
