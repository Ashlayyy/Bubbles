import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { giveawayApiService } from "../../services/giveawayApiService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class CreateGiveawayCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-create",
      description: "Create a new giveaway",
      category: "giveaways",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const title = this.getStringOption("title", true);
    const prize = this.getStringOption("prize", true);
    const duration = this.getIntegerOption("duration", true); // in minutes
    const winnerCount = this.getIntegerOption("winners") || 1;
    const description = this.getStringOption("description");
    const requirements = this.getStringOption("requirements");

    try {
      // Validate duration
      if (duration < 1 || duration > 43200) {
        // 1 minute to 30 days
        return this.createAdminError(
          "Invalid Duration",
          "Giveaway duration must be between 1 minute and 43200 minutes (30 days)."
        );
      }

      // Validate winner count
      if (winnerCount < 1 || winnerCount > 100) {
        return this.createAdminError("Invalid Winner Count", "Winner count must be between 1 and 100.");
      }

      // Check if API client is configured
      if (!giveawayApiService.isConfigured()) {
        return this.createAdminError("Service Unavailable", "Giveaway service is not properly configured.");
      }

      // Calculate end time
      const endTime = new Date(Date.now() + duration * 60 * 1000);

      // Prepare giveaway data
      const giveawayData = {
        title,
        prize,
        winnerCount,
        description: description || undefined,
        requirements: requirements || undefined,
        endTime: endTime.toISOString(),
      };

      // Create giveaway using the API service
      const result = await giveawayApiService.createGiveaway(this.guild.id, giveawayData);

      if (!result.success) {
        return this.createAdminError("Giveaway Creation Error", result.error || "Failed to create giveaway");
      }

      const giveaway = result.data!;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway Created Successfully")
        .setDescription(`**${giveaway.title}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "🏆 Prize",
            value: giveaway.prize,
            inline: false,
          },
          {
            name: "🏅 Winners",
            value: `${giveaway.winnerCount} winner${giveaway.winnerCount > 1 ? "s" : ""}`,
            inline: true,
          },
          {
            name: "⏰ Duration",
            value: `${duration} minutes\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: "📊 Status",
            value: "🟢 Active",
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Created by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add description if provided
      if (giveaway.description) {
        embed.addFields({
          name: "📋 Description",
          value: giveaway.description,
          inline: false,
        });
      }

      // Add requirements if provided
      if (giveaway.requirements) {
        embed.addFields({
          name: "📝 Requirements",
          value: giveaway.requirements,
          inline: false,
        });
      }

      embed.addFields(
        {
          name: "🆔 Giveaway ID",
          value: `\`${giveaway.id}\``,
          inline: true,
        },
        {
          name: "🎫 Current Entries",
          value: "0 entries",
          inline: true,
        },
        {
          name: "📱 How to Enter",
          value: `Use \`/giveaway-enter\` with giveaway ID \`${giveaway.id}\` to enter!`,
          inline: false,
        },
        {
          name: "🔧 Management",
          value:
            "• Use `/giveaway-list` to see all giveaways\n" +
            "• Use `/giveaway-entries` to view entries\n" +
            "• Use `/giveaway-end` to end the giveaway early\n" +
            "• Use `/giveaway-reroll` to reroll winners\n" +
            "• Use `/giveaway-delete` to cancel the giveaway",
          inline: false,
        }
      );

      // Log command usage
      logger.info("Giveaway created successfully", {
        giveawayId: giveaway.id,
        title: giveaway.title,
        prize: giveaway.prize,
        winnerCount: giveaway.winnerCount,
        duration,
        hasRequirements: !!giveaway.requirements,
        hasDescription: !!giveaway.description,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing giveaway-create command:", error);
      return this.createAdminError("Error", "An error occurred while creating the giveaway. Please try again.");
    }
  }
}

export default new CreateGiveawayCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-create")
  .setDescription("Create a new giveaway")
  .setDefaultMemberPermissions(AdminCommand.getDefaultAdminPermissions())
  .addStringOption((option) =>
    option.setName("title").setDescription("Title of the giveaway").setRequired(true).setMaxLength(200)
  )
  .addStringOption((option) =>
    option.setName("prize").setDescription("What the winner(s) will receive").setRequired(true).setMaxLength(500)
  )
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("Duration in minutes (1-43200)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(43200)
  )
  .addIntegerOption((option) =>
    option
      .setName("winners")
      .setDescription("Number of winners (default: 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("Additional description of the giveaway")
      .setRequired(false)
      .setMaxLength(1000)
  )
  .addStringOption((option) =>
    option
      .setName("requirements")
      .setDescription("Requirements to enter the giveaway")
      .setRequired(false)
      .setMaxLength(500)
  );
