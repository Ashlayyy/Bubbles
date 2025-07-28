import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class EnterGiveawayCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-enter",
      description: "Enter a giveaway",
      category: "giveaways",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const giveawayId = this.getStringOption("giveaway-id", true);

    try {
      const giveawayApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get giveaway details to validate entry
      const giveawayResponse = await fetch(`${giveawayApiUrl}/api/giveaways/${this.guild.id}/${giveawayId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!giveawayResponse.ok) {
        if (giveawayResponse.status === 404) {
          return this.createGeneralError(
            "Giveaway Not Found",
            "The specified giveaway was not found. Use `/giveaway-list` to see available giveaways."
          );
        }
        throw new Error(`API request failed: ${giveawayResponse.status}`);
      }

      const giveawayResult = (await giveawayResponse.json()) as any;

      if (!giveawayResult.success) {
        return this.createGeneralError("Error", giveawayResult.error || "Failed to fetch giveaway details");
      }

      const giveaway = giveawayResult.data;

      // Check if giveaway is still active
      if (giveaway.status !== "active") {
        return this.createGeneralError("Giveaway Closed", "This giveaway is no longer accepting entries.");
      }

      // Check if giveaway has ended
      const endTime = new Date(giveaway.endTime);
      if (endTime < new Date()) {
        return this.createGeneralError("Giveaway Ended", "This giveaway has already ended.");
      }

      // Check if user has already entered
      const hasAlreadyEntered = giveaway.entries.some((entry: any) => entry.userId === this.user.id);
      if (hasAlreadyEntered) {
        return this.createGeneralError("Already Entered", "You have already entered this giveaway!");
      }

      // Enter the giveaway
      const enterResponse = await fetch(`${giveawayApiUrl}/api/giveaways/${this.guild.id}/${giveawayId}/enter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          userId: this.user.id,
          username: this.user.username,
        }),
      });

      if (!enterResponse.ok) {
        throw new Error(`API request failed: ${enterResponse.status}`);
      }

      const enterResult = (await enterResponse.json()) as any;

      if (!enterResult.success) {
        return this.createGeneralError("Entry Error", enterResult.error || "Failed to enter giveaway");
      }

      const updatedGiveaway = enterResult.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🎉 Successfully Entered Giveaway!")
        .setDescription(`You have entered: **${giveaway.title}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "🏆 Prize",
            value: giveaway.prize,
            inline: false,
          },
          {
            name: "🏅 Winners",
            value: `${giveaway.winnerCount} winner${giveaway.winnerCount > 1 ? "s" : ""} will be selected`,
            inline: true,
          },
          {
            name: "⏰ Time Left",
            value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: "📊 Current Entries",
            value: `${updatedGiveaway.entryCount || Number(giveaway.entryCount) + 1} entries`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Entry by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add description if available
      if (giveaway.description) {
        embed.addFields({
          name: "📋 Description",
          value: giveaway.description,
          inline: false,
        });
      }

      // Add requirements if available
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
          name: "🎫 Your Entry",
          value: `Entry confirmed at <t:${Math.floor(Date.now() / 1000)}:T>`,
          inline: false,
        },
        {
          name: "📱 What's Next?",
          value:
            "• Winners will be selected automatically when the giveaway ends\n" +
            "• You'll be notified if you win\n" +
            "• Use `/giveaway-list` to see all giveaways\n" +
            "• Use `/giveaway-entries` to view all entries",
          inline: false,
        }
      );

      // Calculate chance of winning
      const totalEntries = updatedGiveaway.entryCount || Number(giveaway.entryCount) + 1;
      const chancePercentage = ((Number(giveaway.winnerCount) / totalEntries) * 100).toFixed(2);

      embed.addFields({
        name: "📈 Your Chances",
        value: `${chancePercentage}% chance of winning\n(${giveaway.winnerCount} winners out of ${totalEntries} entries)`,
        inline: false,
      });

      await this.logCommandUsage("giveaway-enter", {
        giveawayId: giveaway.id,
        giveawayTitle: giveaway.title,
        totalEntries,
        winnerCount: giveaway.winnerCount,
        chancePercentage: parseFloat(chancePercentage),
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing giveaway-enter command:", error);
      return this.createGeneralError("Error", "An error occurred while entering the giveaway. Please try again.");
    }
  }
}

export default new EnterGiveawayCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-enter")
  .setDescription("Enter a giveaway")
  .addStringOption((option) =>
    option.setName("giveaway-id").setDescription("ID of the giveaway to enter").setRequired(true)
  );
