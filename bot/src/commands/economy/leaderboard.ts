import { prisma } from "@shared/database.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class LeaderboardCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "leaderboard",
      description: "View the economy leaderboard",
      category: "economy",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const guildId = this.guild.id;
    const page = this.getIntegerOption("page") || 1;
    const sortBy = this.getStringOption("sort") || "total";

    // Validate page number
    if (page < 1) {
      return this.createGeneralError("Invalid Page", "Page number must be greater than 0.");
    }

    if (page > 100) {
      return this.createGeneralError("Invalid Page", "Page number cannot exceed 100.");
    }

    try {
      const limit = 10;
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const totalCount = await prisma.userEconomy.count({
        where: { guildId },
      });

      const totalPages = Math.ceil(totalCount / limit);

      if (page > totalPages && totalPages > 0) {
        return this.createGeneralError("Invalid Page", `Page ${page} does not exist. Total pages: ${totalPages}`);
      }

      // Get leaderboard data
      const users = await prisma.userEconomy.findMany({
        where: { guildId },
        orderBy:
          sortBy === "balance"
            ? { balance: "desc" }
            : sortBy === "bank"
              ? { bank: "desc" }
              : sortBy === "level"
                ? { level: "desc" }
                : sortBy === "xp"
                  ? { xp: "desc" }
                  : { balance: "desc" }, // Default to balance if invalid sort
        take: limit,
        skip: offset,
      });

      if (users.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("💰 Economy Leaderboard")
              .setDescription("No users found in the economy system yet!")
              .setColor("#ffa500")
              .setTimestamp(),
          ],
          ephemeral: true,
        };
      }

      // Calculate total wealth for each user and get their Discord info
      const leaderboardData = await Promise.all(
        users.map(async (user, index) => {
          const totalWealth = Number(user.balance.toString()) + Number(user.bank.toString());
          let displayName = `<@${user.userId}>`;

          try {
            const discordUser = await this.client.users.fetch(user.userId);
            displayName = discordUser.username;
          } catch (error) {
            // User might have left the server or bot can't fetch them
            displayName = `User ${user.userId.slice(0, 8)}...`;
          }

          return {
            rank: offset + index + 1,
            userId: user.userId,
            displayName,
            balance: Number(user.balance),
            bank: Number(user.bank),
            totalWealth,
            level: user.level,
            xp: user.xp,
            streak: user.streak,
          };
        })
      );

      // Find current user's rank
      let currentUserRank: number | null = null;
      const currentUserId = this.user.id;

      if (!users.some((u) => u.userId === currentUserId)) {
        // Get current user's rank if they're not on this page
        const currentUserEconomy = await prisma.userEconomy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId: currentUserId,
            },
          },
        });

        if (currentUserEconomy) {
          const usersAbove = await prisma.userEconomy.count({
            where: {
              guildId,
              OR:
                sortBy === "balance"
                  ? [{ balance: { gt: currentUserEconomy.balance } }]
                  : sortBy === "bank"
                    ? [{ bank: { gt: currentUserEconomy.bank } }]
                    : sortBy === "level"
                      ? [{ level: { gt: currentUserEconomy.level } }]
                      : sortBy === "xp"
                        ? [{ xp: { gt: currentUserEconomy.xp } }]
                        : [{ balance: { gt: currentUserEconomy.balance } }],
            },
          });
          currentUserRank = usersAbove + 1;
        }
      }

      // Create leaderboard embed
      const sortName =
        sortBy === "balance"
          ? "Balance"
          : sortBy === "bank"
            ? "Bank"
            : sortBy === "level"
              ? "Level"
              : sortBy === "xp"
                ? "XP"
                : "Total Wealth";

      const leaderboardText = leaderboardData
        .map((user) => {
          const medal = user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : "🏅";
          const value =
            sortBy === "balance"
              ? `${user.balance} coins`
              : sortBy === "bank"
                ? `${user.bank} coins`
                : sortBy === "level"
                  ? `Level ${user.level}`
                  : sortBy === "xp"
                    ? `${user.xp} XP`
                    : `${user.totalWealth} coins`;

          return `${medal} **#${user.rank}** ${user.displayName}\n💰 ${value}`;
        })
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`💰 Economy Leaderboard - ${sortName}`)
        .setDescription(leaderboardText)
        .setColor("#ffd700")
        .setFooter({
          text: `Page ${page}/${totalPages} • Total Users: ${totalCount}${currentUserRank ? ` • Your Rank: #${currentUserRank}` : ""}`,
          iconURL: this.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Add current user info if they're not on this page
      if (currentUserRank && !users.some((u) => u.userId === currentUserId)) {
        const currentUserEconomy = await prisma.userEconomy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId: currentUserId,
            },
          },
        });

        if (currentUserEconomy) {
          const currentUserTotal =
            Number(currentUserEconomy.balance.toString()) + Number(currentUserEconomy.bank.toString());
          embed.addFields({
            name: "📊 Your Stats",
            value: `**Rank:** #${currentUserRank}\n**Total Wealth:** ${currentUserTotal} coins\n**Level:** ${currentUserEconomy.level} (${currentUserEconomy.xp} XP)`,
            inline: true,
          });
        }
      }

      await this.logCommandUsage("leaderboard", { page, sortBy });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing leaderboard command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching the leaderboard. Please try again.");
    }
  }
}

export default new LeaderboardCommand();

export const builder = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the economy leaderboard")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("The page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName("sort")
      .setDescription("Sort the leaderboard by")
      .setRequired(false)
      .addChoices(
        { name: "Total Wealth", value: "total" },
        { name: "Balance", value: "balance" },
        { name: "Bank", value: "bank" },
        { name: "Level", value: "level" },
        { name: "XP", value: "xp" }
      )
  );
