import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class CreateReminderCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "reminder-create",
      description: "Create a new reminder",
      category: "reminders",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const title = this.getStringOption("title", true);
    const time = this.getStringOption("time", true);
    const description = this.getStringOption("description");
    const recurring = this.getStringOption("recurring") || "none";
    const isPrivate = this.getBooleanOption("private") || false;
    const priority = this.getStringOption("priority") || "medium";
    const channel = this.getChannelOption("channel");
    const guildId = this.guild.id;
    const userId = this.user.id;

    try {
      // Parse the time input
      const remindTime = this.parseTimeInput(time);
      if (!remindTime) {
        return this.createGeneralError(
          "Invalid Time Format",
          "Please use a valid time format like:\n" +
            "• `10m` (10 minutes)\n" +
            "• `2h` (2 hours)\n" +
            "• `3d` (3 days)\n" +
            "• `2024-12-25 15:30` (specific date/time)\n" +
            "• `tomorrow 9am`"
        );
      }

      if (remindTime <= new Date()) {
        return this.createGeneralError("Invalid Time", "Reminder time must be in the future.");
      }

      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Prepare reminder data
      const reminderData = {
        title,
        description: description || null,
        remindAt: remindTime.toISOString(),
        recurring,
        channelId: channel?.id || this.interaction.channelId,
        userId,
        isPrivate,
        priority,
      };

      // Make API request to create reminder
      const response = await fetch(`${customApiUrl}/api/reminders/${guildId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify(reminderData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Reminder Creation Error", result.error || "Failed to create reminder");
      }

      const reminder = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("⏰ Reminder Created")
        .setDescription(`Successfully created reminder: **${reminder.title}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "📋 Title",
            value: reminder.title,
            inline: true,
          },
          {
            name: "⏰ Remind At",
            value: `<t:${String(Math.floor(new Date(reminder.remindAt).getTime() / 1000))}:F>`,
            inline: true,
          },
          {
            name: "📍 Priority",
            value: this.formatPriority(reminder.priority),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add description if provided
      if (reminder.description) {
        embed.addFields({
          name: "📄 Description",
          value: reminder.description,
          inline: false,
        });
      }

      // Add recurring info
      if (reminder.recurring !== "none") {
        embed.addFields({
          name: "🔄 Recurring",
          value: this.formatRecurring(reminder.recurring),
          inline: true,
        });
      }

      // Add channel info
      const targetChannel = channel || this.interaction.channel;
      embed.addFields({
        name: "📢 Channel",
        value: `<#${reminder.channelId}>`,
        inline: true,
      });

      // Add privacy info
      embed.addFields({
        name: "👁️ Visibility",
        value: reminder.isPrivate ? "🔒 Private" : "👥 Public",
        inline: true,
      });

      embed.addFields(
        {
          name: "🆔 Reminder ID",
          value: `\`${reminder.id}\``,
          inline: true,
        },
        {
          name: "📅 Created",
          value: `<t:${String(Math.floor(new Date(reminder.createdAt).getTime() / 1000))}:R>`,
          inline: true,
        },
        {
          name: "📊 Status",
          value: "🟡 Pending",
          inline: true,
        }
      );

      // Add relative time
      const timeUntil = this.getTimeUntil(new Date(reminder.remindAt));
      embed.addFields({
        name: "⏳ Time Until Reminder",
        value: timeUntil,
        inline: false,
      });

      embed.addFields({
        name: "🔧 Management",
        value:
          "• Use `/reminder-list` to see all reminders\n" +
          "• Use `/reminder-edit` to modify this reminder\n" +
          "• Use `/reminder-delete` to remove this reminder\n" +
          "• Use `/reminder-complete` to mark as done",
        inline: false,
      });

      await this.logCommandUsage("reminder-create", {
        reminderId: reminder.id,
        title: reminder.title,
        priority: reminder.priority,
        recurring: reminder.recurring,
        isPrivate: reminder.isPrivate,
        timeUntilReminder: Math.floor((new Date(reminder.remindAt).getTime() - Date.now()) / 1000),
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing reminder-create command:", error);
      return this.createGeneralError("Error", "An error occurred while creating the reminder. Please try again.");
    }
  }

  private parseTimeInput(input: string): Date | null {
    const now = new Date();

    // Relative time patterns (e.g., 10m, 2h, 3d)
    const relativeMatch = /^(\d+)\s*(m|min|minutes?|h|hr|hours?|d|days?)$/i.exec(input);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();

      const result = new Date(now);
      if (unit.startsWith("m")) {
        result.setMinutes(result.getMinutes() + amount);
      } else if (unit.startsWith("h")) {
        result.setHours(result.getHours() + amount);
      } else if (unit.startsWith("d")) {
        result.setDate(result.getDate() + amount);
      }
      return result;
    }

    // Natural language patterns
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes("tomorrow")) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check for time specification
      const timeMatch = /(\d{1,2}):?(\d{2})?\s*(am|pm)/i.exec(input);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || "0");
        const isPM = timeMatch[3].toLowerCase() === "pm";

        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        tomorrow.setHours(hours, minutes, 0, 0);
      } else {
        tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
      }
      return tomorrow;
    }

    // Try parsing as ISO date or common formats
    try {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {
      // Continue to next attempt
    }

    return null;
  }

  private formatPriority(priority: string): string {
    switch (priority) {
      case "low":
        return "🟢 Low";
      case "medium":
        return "🟡 Medium";
      case "high":
        return "🔴 High";
      default:
        return priority;
    }
  }

  private formatRecurring(recurring: string): string {
    switch (recurring) {
      case "daily":
        return "📅 Daily";
      case "weekly":
        return "📅 Weekly";
      case "monthly":
        return "📅 Monthly";
      default:
        return recurring;
    }
  }

  private getTimeUntil(targetTime: Date): string {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();

    if (diff <= 0) return "Overdue";

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0)
      return `${String(days)} day${days !== 1 ? "s" : ""}, ${String(hours % 24)} hour${hours % 24 !== 1 ? "s" : ""}`;
    if (hours > 0)
      return `${String(hours)} hour${hours !== 1 ? "s" : ""}, ${String(minutes % 60)} minute${minutes % 60 !== 1 ? "s" : ""}`;
    if (minutes > 0) return `${String(minutes)} minute${minutes !== 1 ? "s" : ""}`;
    return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
  }
}

export default new CreateReminderCommand();

export const builder = new SlashCommandBuilder()
  .setName("reminder-create")
  .setDescription("Create a new reminder")
  .addStringOption((option) =>
    option.setName("title").setDescription("Title of the reminder").setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName("time")
      .setDescription("When to remind (e.g., '10m', '2h', '3d', 'tomorrow 9am', '2024-12-25 15:30')")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("description").setDescription("Additional details about the reminder").setMaxLength(1000)
  )
  .addStringOption((option) =>
    option
      .setName("recurring")
      .setDescription("How often to repeat this reminder")
      .addChoices(
        { name: "None (One-time)", value: "none" },
        { name: "Daily", value: "daily" },
        { name: "Weekly", value: "weekly" },
        { name: "Monthly", value: "monthly" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("priority")
      .setDescription("Priority level of the reminder")
      .addChoices({ name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" })
  )
  .addChannelOption((option) =>
    option.setName("channel").setDescription("Channel where the reminder should be sent (defaults to current channel)")
  )
  .addBooleanOption((option) =>
    option.setName("private").setDescription("Whether this reminder should be private (only visible to you)")
  );
