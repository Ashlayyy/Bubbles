import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ListEventsCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "event-list",
      description: "View all events in this server",
      category: "events",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const upcoming = this.getBooleanOption("upcoming") ?? true;
    const createdBy = this.getUserOption("created-by");

    // Validate page number
    if (page < 1) {
      return this.createGeneralError("Invalid Page", "Page number must be greater than 0.");
    }

    try {
      const eventsApiUrl = process.env.API_URL || "http://localhost:3001";

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        upcoming: upcoming.toString(),
      });

      if (createdBy) {
        queryParams.append("createdBy", createdBy.id);
      }

      // Make API request to get events
      const response = await fetch(`${eventsApiUrl}/api/events/${this.guild.id}?${queryParams}`, {
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
        return this.createGeneralError("Events Error", result.error || "Failed to fetch events");
      }

      const { events, pagination } = result.data;

      if (!events || events.length === 0) {
        const noEventsMessage = upcoming ? "No upcoming events found!" : "No events found!";
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("📅 Events")
              .setDescription(noEventsMessage)
              .setColor("#ffa500")
              .addFields({
                name: "📱 Getting Started",
                value: "Create your first event with `/event-create`",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      // Format events for display
      const eventsText = events
        .map((event: any, index: number) => {
          const eventNumber = (page - 1) * 10 + index + 1;
          const startTime = new Date(event.startTime);
          const isUpcoming = startTime > new Date();
          const statusIcon = isUpcoming ? "🔜" : "✅";

          const attendeesText = event.attendeeCount > 0 ? ` (${event.attendeeCount} attending)` : "";

          return (
            `**${eventNumber}.** ${statusIcon} **${event.title}**${attendeesText}\n` +
            `📅 <t:${Math.floor(startTime.getTime() / 1000)}:F>\n` +
            (event.location ? `📍 ${event.location}\n` : "") +
            `🆔 \`${event.id}\``
          );
        })
        .join("\n\n");

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle("📅 Events")
        .setDescription(eventsText || "No events to display")
        .setColor("#9932cc")
        .addFields(
          {
            name: "📊 Summary",
            value:
              `**Total Events:** ${pagination.total}\n` +
              `**Showing:** ${upcoming ? "Upcoming" : "All"} Events\n` +
              `**Total Attendees:** ${events.reduce((sum: number, e: any) => sum + (Number(e.attendeeCount) || 0), 0)}`,
            inline: true,
          },
          {
            name: "🔧 Management",
            value:
              "• `/event-create` - Create new event\n" +
              "• `/event-rsvp` - RSVP to an event\n" +
              "• `/event-edit` - Edit an event\n" +
              "• `/event-delete` - Cancel an event",
            inline: true,
          }
        )
        .setFooter({
          text: `Page ${pagination.page}/${pagination.pages} • Total: ${pagination.total} events`,
          iconURL: this.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Add filter info if filters are applied
      const activeFilters: string[] = [];
      if (!upcoming) activeFilters.push("Showing: All Events");
      if (createdBy) activeFilters.push(`Created by: ${createdBy.username}`);

      if (activeFilters.length > 0) {
        embed.addFields({
          name: "🔍 Active Filters",
          value: activeFilters.join(" • "),
          inline: false,
        });
      }

      await this.logCommandUsage("event-list", {
        page,
        totalEvents: pagination.total,
        upcoming,
        createdBy: createdBy?.id || null,
        activeFilters: activeFilters.length,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing event-list command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching events. Please try again.");
    }
  }
}

export default new ListEventsCommand();

export const builder = new SlashCommandBuilder()
  .setName("event-list")
  .setDescription("View all events in this server")
  .setDefaultMemberPermissions("0")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("Page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  )
  .addBooleanOption((option) =>
    option.setName("upcoming").setDescription("Show only upcoming events (default: true)").setRequired(false)
  )
  .addUserOption((option) =>
    option.setName("created-by").setDescription("Filter events created by specific user").setRequired(false)
  );
