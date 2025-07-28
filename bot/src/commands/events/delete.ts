import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class DeleteEventCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "event-delete",
      description: "Cancel/delete an event",
      category: "events",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const eventId = this.getStringOption("event-id", true);
    const confirm = this.getBooleanOption("confirm") ?? false;

    if (!confirm) {
      return this.createGeneralError(
        "Confirmation Required",
        "You must set `confirm` to `true` to delete an event. This action cannot be undone and will notify all attendees!"
      );
    }

    try {
      const eventsApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get event details for confirmation message
      const eventResponse = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}/${eventId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!eventResponse.ok) {
        if (eventResponse.status === 404) {
          return this.createGeneralError("Event Not Found", "The specified event was not found.");
        }
        throw new Error(`API request failed: ${eventResponse.status}`);
      }

      const eventResult = (await eventResponse.json()) as any;

      if (!eventResult.success) {
        return this.createGeneralError("Error", eventResult.error || "Failed to fetch event details");
      }

      const event = eventResult.data;

      // Check if user is the event creator or has proper permissions
      // Note: In a real implementation, you might want to check if the user has admin permissions
      // or is the event creator. For now, we'll rely on Discord permissions.

      // Delete the event
      const deleteResponse = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}/${eventId}`, {
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
        return this.createGeneralError("Deletion Error", deleteResult.error || "Failed to delete event");
      }

      const eventStartTime = new Date(event.startTime);
      const wasUpcoming = eventStartTime > new Date();

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Event Deleted")
        .setDescription(`Successfully deleted event: **${event.title}**`)
        .setColor("#ff0000")
        .addFields(
          {
            name: "📝 Deleted Event",
            value: event.title,
            inline: true,
          },
          {
            name: "📅 Scheduled Date",
            value: `<t:${Math.floor(eventStartTime.getTime() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "📊 Event Status",
            value: wasUpcoming ? "🔜 Was Upcoming" : "✅ Already Passed",
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Deleted by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add event details if available
      if (event.location) {
        embed.addFields({
          name: "📍 Location",
          value: event.location,
          inline: true,
        });
      }

      if (event.description && event.description.length > 0) {
        embed.addFields({
          name: "📋 Description",
          value: event.description.length > 200 ? event.description.substring(0, 197) + "..." : event.description,
          inline: false,
        });
      }

      // Add RSVP statistics if available
      if (event.totalRSVPs && event.totalRSVPs > 0) {
        embed.addFields({
          name: "👥 RSVPs at Deletion",
          value:
            `**Total RSVPs:** ${event.totalRSVPs}\n` +
            `**Attending:** ${event.attendeeCount || 0}\n` +
            `**Maybe:** ${event.rsvpCounts?.maybe || 0}\n` +
            `**Not Going:** ${event.rsvpCounts?.not_going || 0}`,
          inline: true,
        });
      }

      embed.addFields(
        {
          name: "👤 Deleted by",
          value: this.formatUserDisplay(this.user),
          inline: true,
        },
        {
          name: "⚠️ Important",
          value: wasUpcoming
            ? "All attendees have been automatically notified of the cancellation."
            : "This past event has been removed from the records.",
          inline: false,
        },
        {
          name: "📱 Next Steps",
          value:
            "• Use `/event-list` to view remaining events\n" +
            "• Use `/event-create` to create a new event\n" +
            "• Consider creating a replacement event if needed",
          inline: false,
        }
      );

      await this.logCommandUsage("event-delete", {
        eventId,
        eventTitle: event.title,
        wasUpcoming,
        totalRSVPs: event.totalRSVPs || 0,
        attendeeCount: event.attendeeCount || 0,
        eventStartTime: event.startTime,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing event-delete command:", error);
      return this.createGeneralError("Error", "An error occurred while deleting the event. Please try again.");
    }
  }
}

export default new DeleteEventCommand();

export const builder = new SlashCommandBuilder()
  .setName("event-delete")
  .setDescription("Cancel/delete an event")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) => option.setName("event-id").setDescription("ID of the event to delete").setRequired(true))
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to delete this event (required)").setRequired(true)
  );
