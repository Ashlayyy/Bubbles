import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class EventRSVPCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "event-rsvp",
      description: "RSVP to an event",
      category: "events",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const eventId = this.getStringOption("event-id", true);
    const response = this.getStringOption("response", true) as "going" | "maybe" | "not_going";

    try {
      const eventsApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get event details to show in response
      const eventResponse = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}/${eventId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!eventResponse.ok) {
        if (eventResponse.status === 404) {
          return this.createGeneralError(
            "Event Not Found",
            "The specified event was not found. Use `/event-list` to see available events."
          );
        }
        throw new Error(`API request failed: ${eventResponse.status}`);
      }

      const eventResult = (await eventResponse.json()) as any;

      if (!eventResult.success) {
        return this.createGeneralError("Error", eventResult.error || "Failed to fetch event details");
      }

      const event = eventResult.data;

      // Check if event has passed
      const eventStartTime = new Date(event.startTime);
      if (eventStartTime < new Date()) {
        return this.createGeneralError(
          "Event Has Passed",
          "You cannot RSVP to an event that has already started or finished."
        );
      }

      // Check if event has capacity limits for "going" responses
      if (response === "going" && event.maxAttendees) {
        if (event.attendeeCount >= event.maxAttendees) {
          return this.createGeneralError(
            "Event Full",
            `This event has reached its maximum capacity of ${event.maxAttendees} attendees.`
          );
        }
      }

      // Make RSVP request
      const rsvpResponse = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}/${eventId}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          status: response,
          userId: this.user.id,
          username: this.user.username,
        }),
      });

      if (!rsvpResponse.ok) {
        throw new Error(`API request failed: ${rsvpResponse.status}`);
      }

      const rsvpResult = (await rsvpResponse.json()) as any;

      if (!rsvpResult.success) {
        return this.createGeneralError("RSVP Error", rsvpResult.error || "Failed to update RSVP");
      }

      const rsvpData = rsvpResult.data;

      // Create response embed based on RSVP status
      const responseEmojis = {
        going: "✅",
        maybe: "❓",
        not_going: "❌",
      };

      const responseMessages = {
        going: "attending",
        maybe: "might attend",
        not_going: "not attending",
      };

      const embed = new EmbedBuilder()
        .setTitle(`${responseEmojis[response]} RSVP Updated`)
        .setDescription(`You are now marked as **${responseMessages[response]}** for **${event.title}**`)
        .setColor(response === "going" ? "#00ff00" : response === "maybe" ? "#ffff00" : "#ff0000")
        .addFields(
          {
            name: "📅 Event",
            value: event.title,
            inline: true,
          },
          {
            name: "📅 Date & Time",
            value: `<t:${Math.floor(eventStartTime.getTime() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "📍 Status",
            value: `${responseEmojis[response]} ${responseMessages[response].charAt(0).toUpperCase() + responseMessages[response].slice(1)}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `RSVP by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add event details
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

      // Add RSVP counts if available
      if (rsvpData.rsvpCounts) {
        const counts = rsvpData.rsvpCounts;
        embed.addFields({
          name: "👥 Current RSVPs",
          value: `✅ Going: ${counts.going}\n❓ Maybe: ${counts.maybe}\n❌ Not Going: ${counts.not_going}`,
          inline: true,
        });
      }

      // Add capacity info if applicable
      if (event.maxAttendees) {
        const spotsLeft = event.maxAttendees - (rsvpData.rsvpCounts?.going || 0);
        embed.addFields({
          name: "🎫 Capacity",
          value: `${rsvpData.rsvpCounts?.going || 0}/${event.maxAttendees} attending\n${spotsLeft} spots remaining`,
          inline: true,
        });
      }

      // Add approval notice if required
      if (event.requiresApproval && response === "going") {
        embed.addFields({
          name: "⏳ Approval Required",
          value: "Your attendance is pending approval from the event organizer.",
          inline: false,
        });
      }

      embed.addFields({
        name: "📱 Actions",
        value:
          "• Use `/event-rsvp` again to change your response\n" +
          "• Use `/event-list` to view other events\n" +
          "• Event reminders will be sent automatically",
        inline: false,
      });

      await this.logCommandUsage("event-rsvp", {
        eventId,
        eventTitle: event.title,
        response,
        requiresApproval: event.requiresApproval,
        eventStartTime: event.startTime,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing event-rsvp command:", error);
      return this.createGeneralError("Error", "An error occurred while updating your RSVP. Please try again.");
    }
  }
}

export default new EventRSVPCommand();

export const builder = new SlashCommandBuilder()
  .setName("event-rsvp")
  .setDescription("RSVP to an event")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option.setName("event-id").setDescription("ID of the event to RSVP to").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("response")
      .setDescription("Your RSVP response")
      .setRequired(true)
      .addChoices(
        { name: "✅ Going", value: "going" },
        { name: "❓ Maybe", value: "maybe" },
        { name: "❌ Not Going", value: "not_going" }
      )
  );
