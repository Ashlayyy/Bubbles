import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

/**
 * Timestamp Command - Generate Discord timestamps for different formats
 */
export class TimestampCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "timestamp",
      description: "Generate Discord timestamps for different formats",
      category: "general",
      permissions: {
        level: PermissionLevel.PUBLIC,
        isConfigurable: true,
      },
      ephemeral: false,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const timeInput = this.getStringOption("time", true);
    const format = this.getStringOption("format") ?? "f";

    try {
      // Parse the input time
      const timestamp = parseTimeInput(timeInput);

      if (!timestamp) {
        return {
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("❌ Invalid Time Format")
              .setDescription(
                "I couldn't understand that time format. Try these examples:\n" +
                  "• `2024-12-25 15:30`\n" +
                  "• `December 25, 2024 3:30 PM`\n" +
                  "• `tomorrow 3pm`\n" +
                  "• `in 2 hours`\n" +
                  "• `next friday`"
              )
              .setTimestamp(),
          ],
          ephemeral: true,
        };
      }

      const unixTimestamp = Math.floor(timestamp.getTime() / 1000);
      const discordTimestamp = `<t:${unixTimestamp}:${format}>`;

      // Create example of all formats
      const allFormats = [
        { name: "Short Time", format: "t", example: `<t:${unixTimestamp}:t>` },
        { name: "Long Time", format: "T", example: `<t:${unixTimestamp}:T>` },
        { name: "Short Date", format: "d", example: `<t:${unixTimestamp}:d>` },
        { name: "Long Date", format: "D", example: `<t:${unixTimestamp}:D>` },
        { name: "Short Date/Time", format: "f", example: `<t:${unixTimestamp}:f>` },
        { name: "Long Date/Time", format: "F", example: `<t:${unixTimestamp}:F>` },
        { name: "Relative Time", format: "R", example: `<t:${unixTimestamp}:R>` },
      ];

      const embed = new EmbedBuilder()
        .setTitle("🕒 Discord Timestamp Generator")
        .setColor(0x3498db)
        .setDescription(`**Your selected format:** ${discordTimestamp}`)
        .addFields({
          name: "📋 Copy This Code",
          value: `\`\`\`<t:${unixTimestamp}:${format}>\`\`\``,
          inline: false,
        })
        .setTimestamp();

      // Add all format examples
      const formatExamples = allFormats.map((f) => `**${f.name} (\`${f.format}\`):** ${f.example}`).join("\n");

      embed.addFields({
        name: "🎨 All Format Examples",
        value: formatExamples,
        inline: false,
      });

      // Add helpful info
      embed.addFields({
        name: "💡 How to Use",
        value:
          "Copy the code above and paste it anywhere in Discord!\n" +
          "The timestamp will automatically adjust to each user's timezone.",
        inline: false,
      });

      // Log command usage
      await this.client.logManager.log(this.guild.id, "COMMAND_TIMESTAMP", {
        userId: this.user.id,
        channelId: this.interaction.channel?.id,
        metadata: {
          timeInput,
          format,
          unixTimestamp,
          parsedTime: timestamp.toISOString(),
        },
      });

      return { embeds: [embed] };
    } catch (error) {
      logger.error("Error in timestamp command:", error);
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to generate timestamp. Please try again with a different time format.")
            .setTimestamp(),
        ],
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new TimestampCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("timestamp")
  .setDescription("Generate Discord timestamps for different formats")
  .addStringOption((opt) =>
    opt
      .setName("time")
      .setDescription("Time/date to convert (e.g. '2024-12-25 15:30', 'tomorrow 3pm', '2 hours')")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("format")
      .setDescription("Display format")
      .addChoices(
        { name: "Short Time (16:20)", value: "t" },
        { name: "Long Time (4:20:30 PM)", value: "T" },
        { name: "Short Date (20/04/2021)", value: "d" },
        { name: "Long Date (20 April 2021)", value: "D" },
        { name: "Short Date/Time (20 April 2021 16:20)", value: "f" },
        { name: "Long Date/Time (Tuesday, 20 April 2021 4:20 PM)", value: "F" },
        { name: "Relative Time (2 months ago)", value: "R" }
      )
  );

function parseTimeInput(input: string): Date | null {
  const now = new Date();
  const lower = input.toLowerCase().trim();

  try {
    // Handle relative times
    if (lower.includes("in ") || lower.includes("after ")) {
      return parseRelativeTime(lower, now);
    }

    // Handle "tomorrow", "today", "yesterday"
    if (lower.includes("tomorrow")) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const timeMatch = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i.exec(input);
      if (timeMatch) {
        const [, hours, minutes = "0", ampm] = timeMatch;
        let hour = parseInt(hours, 10);
        if (ampm && ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
        if (ampm && ampm.toLowerCase() === "am" && hour === 12) hour = 0;
        tomorrow.setHours(hour, parseInt(minutes, 10), 0, 0);
      }
      return tomorrow;
    }

    if (lower.includes("today")) {
      const today = new Date(now);
      const timeMatch = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i.exec(input);
      if (timeMatch) {
        const [, hours, minutes = "0", ampm] = timeMatch;
        let hour = parseInt(hours, 10);
        if (ampm && ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
        if (ampm && ampm.toLowerCase() === "am" && hour === 12) hour = 0;
        today.setHours(hour, parseInt(minutes, 10), 0, 0);
      }
      return today;
    }

    if (lower.includes("yesterday")) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Handle "next [day]"
    if (lower.includes("next ")) {
      return parseNextDay(lower, now);
    }

    // Try parsing as standard date
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try parsing common formats
    const formats = [
      /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/,
      /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/,
    ];

    for (const format of formats) {
      const match = format.exec(input);
      if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10)
        );
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseRelativeTime(input: string, from: Date): Date | null {
  const relativeRegex = /in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?/i;
  const match = relativeRegex.exec(input);

  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const result = new Date(from);
    switch (unit) {
      case "second":
        result.setSeconds(result.getSeconds() + amount);
        break;
      case "minute":
        result.setMinutes(result.getMinutes() + amount);
        break;
      case "hour":
        result.setHours(result.getHours() + amount);
        break;
      case "day":
        result.setDate(result.getDate() + amount);
        break;
      case "week":
        result.setDate(result.getDate() + amount * 7);
        break;
      case "month":
        result.setMonth(result.getMonth() + amount);
        break;
      case "year":
        result.setFullYear(result.getFullYear() + amount);
        break;
    }
    return result;
  }

  return null;
}

function parseNextDay(input: string, from: Date): Date | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayRegex = /next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i;
  const match = dayRegex.exec(input);

  if (match) {
    const targetDay = match[1].toLowerCase();
    const targetDayIndex = days.indexOf(targetDay);
    const currentDayIndex = from.getDay();

    let daysToAdd = targetDayIndex - currentDayIndex;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    const result = new Date(from);
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  return null;
}
