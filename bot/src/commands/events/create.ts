import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class CreateEventCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "event-create",
      description: "Create a new event",
      category: "events",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const title = this.getStringOption("title", true);
    const description = this.getStringOption("description") || "";
    const startTime = this.getStringOption("start-time", true);
    const endTime = this.getStringOption("end-time");
    const location = this.getStringOption("location");
    const maxAttendees = this.getIntegerOption("max-attendees");
    const requiresApproval = this.getBooleanOption("requires-approval") ?? false;

    try {
      // Parse and validate start time
      const startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        return this.createGeneralError(
          "Invalid Start Time",
          "Please provide a valid start time in ISO format (e.g., 2024-01-15T19:00:00Z) or relative format (e.g., 'tomorrow 7pm')."
        );
      }

      if (startDate < new Date()) {
        return this.createGeneralError("Invalid Start Time", "Start time cannot be in the past.");
      }

      // Parse and validate end time if provided
      let endDate: Date | null = null;
      if (endTime) {
        endDate = new Date(endTime);
        if (isNaN(endDate.getTime())) {
          return this.createGeneralError("Invalid End Time", "Please provide a valid end time in ISO format.");
        }

        if (endDate <= startDate) {
          return this.createGeneralError("Invalid End Time", "End time must be after start time.");
        }
      }

      const eventsApiUrl = process.env.API_URL || "http://localhost:3001";

      // Prepare event data
      const eventData = {
        title,
        description,
        startTime: startDate.toISOString(),
        endTime: endDate?.toISOString() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        location,
        maxAttendees,
        requiresApproval,
        reminderTimes: [60, 15], // 1 hour and 15 minutes before
      };

      // Make API request to create event
      const response = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("Event Creation Error", result.error || "Failed to create event");
      }

      const event = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("📅 Event Created Successfully")
        .setDescription(`**${event.title}** has been created!`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "📝 Event Title",
            value: event.title,
            inline: true,
          },
          {
            name: "📅 Start Time",
            value: `<t:${Math.floor(new Date(event.startTime).getTime() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "⏰ Timezone",
            value: event.timezone || "UTC",
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add optional fields
      if (event.description) {
        embed.addFields({
          name: "📋 Description",
          value: event.description.length > 1024 ? event.description.substring(0, 1021) + "..." : event.description,
          inline: false,
        });
      }

      if (event.endTime) {
        embed.addFields({
          name: "🏁 End Time",
          value: `<t:${Math.floor(new Date(event.endTime).getTime() / 1000)}:F>`,
          inline: true,
        });
      }

      if (event.location) {
        embed.addFields({
          name: "📍 Location",
          value: event.location,
          inline: true,
        });
      }

      if (event.maxAttendees) {
        embed.addFields({
          name: "👥 Max Attendees",
          value: event.maxAttendees.toString(),
          inline: true,
        });
      }

      embed.addFields(
        {
          name: "🎫 RSVP Settings",
          value: event.requiresApproval ? "✅ Requires Approval" : "🚀 Open Registration",
          inline: true,
        },
        {
          name: "🆔 Event ID",
          value: `\`${event.id}\``,
          inline: true,
        },
        {
          name: "📱 Management",
          value:
            "• Use `/event-rsvp` to RSVP to this event\n" +
            "• Use `/event-list` to view all events\n" +
            "• Use `/event-edit` to modify this event\n" +
            "• Use `/event-delete` to cancel this event",
          inline: false,
        }
      );

      await this.logCommandUsage("event-create", {
        eventId: event.id,
        title: event.title,
        startTime: event.startTime,
        maxAttendees: event.maxAttendees || 0,
        requiresApproval: event.requiresApproval,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing event-create command:", error);
      return this.createGeneralError("Error", "An error occurred while creating the event. Please try again.");
    }
  }
}

export default new CreateEventCommand();

export const builder = new SlashCommandBuilder()
  .setName("event-create")
  .setDescription("Create a new event")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option.setName("title").setDescription("Title of the event").setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName("start-time")
      .setDescription("Start time (ISO format: 2024-01-15T19:00:00Z or relative: 'tomorrow 7pm')")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("description").setDescription("Description of the event").setRequired(false).setMaxLength(2000)
  )
  .addStringOption((option) =>
    option.setName("end-time").setDescription("End time (ISO format: 2024-01-15T21:00:00Z)").setRequired(false)
  )
  .addStringOption((option) =>
    option.setName("location").setDescription("Location of the event").setRequired(false).setMaxLength(200)
  )
  .addIntegerOption((option) =>
    option
      .setName("max-attendees")
      .setDescription("Maximum number of attendees")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10000)
  )
  .addBooleanOption((option) =>
    option.setName("requires-approval").setDescription("Whether RSVPs require approval").setRequired(false)
  );
