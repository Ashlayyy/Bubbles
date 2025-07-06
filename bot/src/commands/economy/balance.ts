import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../../../shared/src/database.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class BalanceCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "balance",
      description: "Check your or someone else's balance",
      category: "economy",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user") ?? this.user;
    const guildId = this.guild.id;

    try {
      // Get user economy data
      let userEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId: targetUser.id,
          },
        },
      });

      // Create default economy if doesn't exist
      if (!userEconomy) {
        userEconomy = await prisma.userEconomy.create({
          data: {
            guildId,
            userId: targetUser.id,
            balance: BigInt(100), // Starting balance
            bank: BigInt(0),
            xp: 0,
            level: 1,
            streak: 0,
            inventory: [],
          },
        });
      }

      // Calculate next daily availability
      let nextDailyText = "Available now!";
      if (userEconomy.lastDaily) {
        const lastDaily = new Date(userEconomy.lastDaily);
        const nextDaily = new Date(lastDaily);
        nextDaily.setDate(nextDaily.getDate() + 1);

        const now = new Date();
        if (now < nextDaily) {
          const timeUntilNext = nextDaily.getTime() - now.getTime();
          const hoursUntil = Math.floor(timeUntilNext / (1000 * 60 * 60));
          const minutesUntil = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
          nextDailyText = `${hoursUntil}h ${minutesUntil}m`;
        }
      }

      const totalNetWorth = Number(userEconomy.balance) + Number(userEconomy.bank);

      const embed = new EmbedBuilder()
        .setTitle(`${this.formatUserDisplay(targetUser)}'s Economy`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor("#00ff00")
        .addFields(
          {
            name: "💰 Wallet",
            value: `${userEconomy.balance.toString()} coins`,
            inline: true,
          },
          {
            name: "🏦 Bank",
            value: `${userEconomy.bank.toString()} coins`,
            inline: true,
          },
          {
            name: "📊 Total Net Worth",
            value: `${totalNetWorth.toString()} coins`,
            inline: true,
          },
          {
            name: "🎯 Level",
            value: `${userEconomy.level}`,
            inline: true,
          },
          {
            name: "⚡ XP",
            value: `${userEconomy.xp}`,
            inline: true,
          },
          {
            name: "🔥 Daily Streak",
            value: `${userEconomy.streak} days`,
            inline: true,
          },
          {
            name: "🎁 Next Daily",
            value: nextDailyText,
            inline: true,
          },
          {
            name: "🎒 Inventory Items",
            value: `${Array.isArray(userEconomy.inventory) ? userEconomy.inventory.length : 0} items`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Requested by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

      await this.logCommandUsage("balance", { target: targetUser.id });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing balance command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while fetching balance information. Please try again."
      );
    }
  }
}

export default new BalanceCommand();

export const builder = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your or someone else's balance")
  .addUserOption((option) => option.setName("user").setDescription("The user to check balance for").setRequired(false));
