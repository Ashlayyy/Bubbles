import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
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
    ),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const timeInput = interaction.options.getString("time", true);
    const format = interaction.options.getString("format") ?? "f";

    try {
      // Parse the input time
      const timestamp = parseTimeInput(timeInput);

      if (!timestamp) {
        await interaction.reply({
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
        });
        return;
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

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(interaction.guild.id, "COMMAND_TIMESTAMP", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          timeInput,
          format,
          unixTimestamp,
          parsedTime: timestamp.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error in timestamp command:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to generate timestamp. Please try again with a different time format.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.PUBLIC,
      isConfigurable: true,
    },
  }
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

    for (const formatRegex of formats) {
      const match = formatRegex.exec(input);
      if (match) {
        const [, a, b, c, hours, minutes] = match;
        let year, month, day;

        if (formatRegex.source.includes("\\d{4}")) {
          // Year first format
          year = parseInt(a, 10);
          month = parseInt(b, 10) - 1;
          day = parseInt(c, 10);
        } else {
          // Month/day first format
          month = parseInt(a, 10) - 1;
          day = parseInt(b, 10);
          year = parseInt(c, 10);
        }

        return new Date(year, month, day, parseInt(hours, 10), parseInt(minutes, 10));
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseRelativeTime(input: string, from: Date): Date | null {
  const timeRegex = /(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?/gi;
  const matches = Array.from(input.matchAll(timeRegex));

  if (matches.length === 0) return null;

  const result = new Date(from);

  for (const match of matches) {
    const [, amount, unit] = match;
    const num = parseInt(amount, 10);

    switch (unit.toLowerCase()) {
      case "minute":
      case "min":
        result.setMinutes(result.getMinutes() + num);
        break;
      case "hour":
      case "hr":
        result.setHours(result.getHours() + num);
        break;
      case "day":
        result.setDate(result.getDate() + num);
        break;
      case "week":
        result.setDate(result.getDate() + num * 7);
        break;
      case "month":
        result.setMonth(result.getMonth() + num);
        break;
      case "year":
        result.setFullYear(result.getFullYear() + num);
        break;
    }
  }

  return result;
}

function parseNextDay(input: string, from: Date): Date | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMatch = /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.exec(input);
  const day = dayMatch?.[1];

  if (!day) return null;

  const targetDay = days.indexOf(day.toLowerCase());
  const currentDay = from.getDay();
  const daysUntilNext = (targetDay - currentDay + 7) % 7 || 7;

  const result = new Date(from);
  result.setDate(result.getDate() + daysUntilNext);
  result.setHours(12, 0, 0, 0); // Default to noon

  return result;
}
