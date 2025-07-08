import {
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import logger from "../../logger.js";
import { musicService, type SearchResult } from "../../services/musicService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class MusicAddCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "add",
      description: "Search and add music to the queue",
      category: "music",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected shouldAutoDefer(): boolean {
    return true;
  }

  protected async execute(): Promise<CommandResponse> {
    const query = this.getStringOption("query", true);

    // Check if user is in a voice channel
    const voiceChannel = this.member?.voice?.channel;
    if (!voiceChannel) {
      return this.createGeneralError("Not in Voice Channel", "You must be in a voice channel to add music!");
    }

    try {
      // Check if query is a direct URL
      if (this.isDirectUrl(query)) {
        return await this.handleDirectUrl(query);
      }

      // Search for tracks
      const searchResults = await musicService.search(query, 10);

      if (searchResults.length === 0) {
        return this.createGeneralError("No Results", `No tracks found for "${query}". Try a different search term.`);
      }

      // Create search results embed (ephemeral)
      const searchEmbed = new EmbedBuilder()
        .setTitle("🔍 Search Results")
        .setDescription(
          `Found ${searchResults.length} results for **"${query}"**\n\nSelect a track to add to the queue:`
        )
        .setColor("#0099ff")
        .setTimestamp();

      // Create select menu with search results
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`music_select_${this.user.id}_${Date.now()}`)
        .setPlaceholder("Choose a track to add to the queue...")
        .setMaxValues(1);

      // Add options to select menu
      for (let i = 0; i < Math.min(searchResults.length, 25); i++) {
        const result = searchResults[i];
        const duration = this.formatDuration(result.duration);
        const platformIcon = this.getPlatformIcon(result.platform);

        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${result.title} - ${result.artist}`)
            .setDescription(`${platformIcon} ${result.platform} • ${duration}`)
            .setValue(
              JSON.stringify({
                id: result.id,
                title: result.title,
                artist: result.artist,
                url: result.url,
                duration: result.duration,
                thumbnail: result.thumbnail,
                platform: result.platform,
              })
            )
        );
      }

      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Create search results list for embed
      const resultsList = searchResults
        .slice(0, 10)
        .map((result, index) => {
          const duration = this.formatDuration(result.duration);
          const platformIcon = this.getPlatformIcon(result.platform);
          return `**${index + 1}.** ${result.title} - ${result.artist}\n${platformIcon} *${result.platform}* • *${duration}*`;
        })
        .join("\n\n");

      searchEmbed.addFields({
        name: "📋 Results",
        value: resultsList.length > 1024 ? resultsList.substring(0, 1021) + "..." : resultsList,
        inline: false,
      });

      // Create the collector after setting up the response
      const response = {
        embeds: [searchEmbed],
        components: [actionRow],
        ephemeral: true,
      };

      // Send the response and create collector
      await this.sendResponse(response);
      const message = await this.interaction.fetchReply();

      // Set up collector for select menu interactions
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000, // 60 seconds
        filter: (interaction) =>
          interaction.user.id === this.user.id && interaction.customId.startsWith("music_select_"),
      });

      collector.on("collect", (selectInteraction) => {
        void (async () => {
          try {
            const selectedData = JSON.parse(selectInteraction.values[0]) as SearchResult;

            // Convert search result to track info
            const trackInfo = await musicService.getTrackInfo(selectedData.url);
            if (!trackInfo) {
              await selectInteraction.update({
                embeds: [this.createGeneralError("Error", "Failed to get track information.").embeds![0]],
                components: [],
              });
              return;
            }

            // Add track to queue
            const position = await musicService.addToQueue(this.guild.id, trackInfo, this.user.id, this.user.username);

            // Create confirmation embed (public)
            const confirmEmbed = new EmbedBuilder()
              .setTitle(position === 1 ? "🎵 Now Playing" : "✅ Added to Queue")
              .setDescription(`**${trackInfo.title}** by **${trackInfo.artist}**`)
              .setColor(position === 1 ? "#00ff00" : "#0099ff")
              .addFields(
                { name: "⏱️ Duration", value: this.formatDuration(trackInfo.duration), inline: true },
                {
                  name: "🎤 Platform",
                  value: trackInfo.platform.charAt(0).toUpperCase() + trackInfo.platform.slice(1),
                  inline: true,
                },
                { name: "📍 Position", value: position === 1 ? "Now Playing" : `#${position}`, inline: true },
                { name: "👤 Requested by", value: this.user.username, inline: true }
              )
              .setTimestamp();

            if (trackInfo.thumbnail) {
              confirmEmbed.setThumbnail(trackInfo.thumbnail);
            }

            // Update the interaction to show confirmation (no longer ephemeral)
            await selectInteraction.update({
              embeds: [confirmEmbed],
              components: [],
            });

            // Log command usage
            logger.info("Music add command executed", {
              query,
              selectedTrack: trackInfo.title,
              position,
              userId: this.user.id,
              guildId: this.guild.id,
            });
          } catch (error) {
            logger.error("Error processing music selection:", error);
            await selectInteraction.update({
              embeds: [this.createGeneralError("Error", "Failed to add track to queue.").embeds![0]],
              components: [],
            });
          }
        })();
      });

      collector.on("end", (collected) => {
        void (async () => {
          if (collected.size === 0) {
            // Update message to show timeout
            try {
              await this.interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("⏱️ Search Expired")
                    .setDescription("Search results expired. Please run the command again.")
                    .setColor("#ff9900"),
                ],
                components: [],
              });
            } catch (error) {
              logger.error("Error updating expired search:", error);
            }
          }
        })();
      });

      // Return empty response since we handled the interaction above
      return {};
    } catch (error) {
      logger.error("Error in music add command:", error);
      return this.createGeneralError("Error", "Failed to search for tracks.");
    }
  }

  private async handleDirectUrl(url: string): Promise<CommandResponse> {
    try {
      const trackInfo = await musicService.getTrackInfo(url);
      if (!trackInfo) {
        return this.createGeneralError("Error", "Failed to get track information from URL.");
      }

      const position = await musicService.addToQueue(this.guild.id, trackInfo, this.user.id, this.user.username);

      const embed = new EmbedBuilder()
        .setTitle(position === 1 ? "🎵 Now Playing" : "✅ Added to Queue")
        .setDescription(`**${trackInfo.title}** by **${trackInfo.artist}**`)
        .setColor(position === 1 ? "#00ff00" : "#0099ff")
        .addFields(
          { name: "⏱️ Duration", value: this.formatDuration(trackInfo.duration), inline: true },
          {
            name: "🎤 Platform",
            value: trackInfo.platform.charAt(0).toUpperCase() + trackInfo.platform.slice(1),
            inline: true,
          },
          { name: "📍 Position", value: position === 1 ? "Now Playing" : `#${position}`, inline: true },
          { name: "👤 Requested by", value: this.user.username, inline: true }
        )
        .setTimestamp();

      if (trackInfo.thumbnail) {
        embed.setThumbnail(trackInfo.thumbnail);
      }

      logger.info("Music add command executed (direct URL)", {
        url,
        trackTitle: trackInfo.title,
        position,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error handling direct URL:", error);
      return this.createGeneralError("Error", "Failed to add track from URL.");
    }
  }

  private isDirectUrl(query: string): boolean {
    try {
      const url = new URL(query);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private formatDuration(duration: number): string {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  private getPlatformIcon(platform: string): string {
    switch (platform) {
      case "youtube":
        return "🎥";
      case "soundcloud":
        return "🔊";
      case "spotify":
        return "🎵";
      case "direct":
        return "📁";
      default:
        return "🎶";
    }
  }
}

export default new MusicAddCommand();

export const builder = new SlashCommandBuilder()
  .setName("add")
  .setDescription("Search and add music to the queue")
  .addStringOption((option) =>
    option.setName("query").setDescription("Song name or URL to search for").setRequired(true)
  );
