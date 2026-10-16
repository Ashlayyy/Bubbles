import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ListRemindersCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "reminder-list",
      description: "List all reminders in this server",
      category: "reminders",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const status = this.getStringOption("status") || "pending";
    const priority = this.getStringOption("priority");
    const user = this.getUserOption("user");
    const showOverdue = this.getBooleanOption("overdue") || false;
    const guildId = this.guild.id;

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        status,
      });

      if (priority) {
        params.append("priority", priority);
      }

      if (user) {
        params.append("userId", user.id);
      }

      if (showOverdue) {
        params.append("overdue", "true");
      }

      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Fetch reminders from API
      const response = await fetch(`${customApiUrl}/api/reminders/${guildId}?${String(params)}`, {
        headers: {
          Authorization: `Bearer ${String(process.env.API_TOKEN)}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.success) {
        return this.createGeneralError("API Error", data.error || "Failed to fetch reminders.");
      }

      const { reminders, pagination } = data.data;

      if (reminders.length === 0) {
        const embed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("⏰ Reminders")
          .setDescription(this.getEmptyMessage(status, user, showOverdue))
          .setFooter({ text: "Use /reminder-create to create your first reminder!" });

        return { embeds: [embed], ephemeral: false };
      }

      // Create embed with reminder list
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("⏰ Reminders")
        .setDescription(this.getListDescription(status, user, showOverdue));

      // Add reminder fields
      reminders.forEach((reminder: any, index: number) => {
        const timeDisplay =
          reminder.status === "pending"
            ? `<t:${String(Math.floor(new Date(reminder.remindAt).getTime() / 1000))}:R>`
            : reminder.status === "completed"
              ? `✅ Completed <t:${String(Math.floor(new Date(reminder.completedAt).getTime() / 1000))}:R>`
              : "❌ Cancelled";

        const priorityIcon = this.getPriorityIcon(reminder.priority);
        const recurringIcon = reminder.recurring !== "none" ? "🔄" : "";
        const privateIcon = reminder.isPrivate ? "🔒" : "";

        const value = [
          timeDisplay,
          reminder.description
            ? `*${reminder.description.substring(0, 50)}${reminder.description.length > 50 ? "..." : ""}*`
            : "",
          `${priorityIcon} ${recurringIcon} ${privateIcon} | <@${reminder.userId}> | \`${reminder.id}\``,
        ]
          .filter(Boolean)
          .join("\n");

        embed.addFields({
          name: `${String(index + 1)}. ${reminder.title}`,
          value,
          inline: false,
        });
      });

      // Add pagination info
      embed.setFooter({
        text: `Page ${String(pagination.currentPage)} of ${String(pagination.totalPages)} • Total: ${String(pagination.totalItems)} reminders`,
      });

      // Add action buttons info
      embed.addFields({
        name: "🔧 Actions",
        value:
          "• `/reminder-edit` - Edit a reminder\n" +
          "• `/reminder-delete` - Delete a reminder\n" +
          "• `/reminder-complete` - Mark as completed\n" +
          "• `/reminder-view` - View detailed information",
        inline: false,
      });

      await this.logCommandUsage("reminder-list", {
        page,
        status,
        priority: priority || null,
        userId: user?.id || null,
        showOverdue,
        reminderCount: reminders.length,
        totalReminders: pagination.totalItems,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error listing reminders:", error);
      return this.createGeneralError("Error", "An error occurred while fetching reminders. Please try again later.");
    }
  }

  private getEmptyMessage(status: string, user: any, showOverdue: boolean): string {
    if (showOverdue) {
      return "No overdue reminders found.";
    }

    if (user) {
      return `No ${status} reminders found for ${user.username}.`;
    }

    switch (status) {
      case "pending":
        return "No pending reminders found in this server.";
      case "completed":
        return "No completed reminders found in this server.";
      case "cancelled":
        return "No cancelled reminders found in this server.";
      default:
        return "No reminders found with the specified criteria.";
    }
  }

  private getListDescription(status: string, user: any, showOverdue: boolean): string {
    let description = "";

    if (showOverdue) {
      description = "Showing overdue reminders:";
    } else if (user) {
      description = `Showing ${status} reminders for ${user.username}:`;
    } else {
      description = `Showing ${status} reminders:`;
    }

    return description;
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case "low":
        return "🟢";
      case "medium":
        return "🟡";
      case "high":
        return "🔴";
      default:
        return "⚪";
    }
  }
}

export default new ListRemindersCommand();

export const builder = new SlashCommandBuilder()
  .setName("reminder-list")
  .setDescription("List all reminders in this server")
  .addIntegerOption((option) => option.setName("page").setDescription("Page number (default: 1)").setMinValue(1))
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Filter by status")
      .addChoices(
        { name: "Pending", value: "pending" },
        { name: "Completed", value: "completed" },
        { name: "Cancelled", value: "cancelled" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("priority")
      .setDescription("Filter by priority")
      .addChoices({ name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" })
  )
  .addUserOption((option) => option.setName("user").setDescription("Filter by user"))
  .addBooleanOption((option) => option.setName("overdue").setDescription("Show only overdue reminders"));
