import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../../../shared/src/database.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class InventoryCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "inventory",
      description: "View your inventory of purchased items",
      category: "economy",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const guildId = this.guild.id;
    const targetUser = this.getUserOption("user") ?? this.user;
    const page = this.getIntegerOption("page") || 1;

    // Validate page number
    if (page < 1) {
      return this.createGeneralError("Invalid Page", "Page number must be greater than 0.");
    }

    if (page > 100) {
      return this.createGeneralError("Invalid Page", "Page number cannot exceed 100.");
    }

    try {
      // Get user economy data
      const userEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId: targetUser.id,
          },
        },
      });

      if (!userEconomy) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle(`🎒 ${this.formatUserDisplay(targetUser)}'s Inventory`)
              .setDescription("This user hasn't started their economy journey yet!")
              .setColor("#ffa500")
              .setTimestamp(),
          ],
          ephemeral: true,
        };
      }

      const inventory = Array.isArray(userEconomy.inventory) ? userEconomy.inventory : [];

      if (inventory.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle(`🎒 ${this.formatUserDisplay(targetUser)}'s Inventory`)
              .setDescription("Inventory is empty! Visit the shop to purchase items.")
              .setColor("#ffa500")
              .addFields(
                {
                  name: "💰 Balance",
                  value: `${userEconomy.balance.toString()} coins`,
                  inline: true,
                },
                {
                  name: "🏦 Bank",
                  value: `${userEconomy.bank.toString()} coins`,
                  inline: true,
                },
                {
                  name: "🎯 Level",
                  value: `${userEconomy.level}`,
                  inline: true,
                }
              )
              .setTimestamp(),
          ],
          ephemeral: true,
        };
      }

      // Group items by type/name
      const itemCounts = new Map<string, { count: number; item: any; totalValue: number }>();

      inventory.forEach((item: any) => {
        const key = `${item.itemId || item.name}`;
        if (!itemCounts.has(key)) {
          itemCounts.set(key, { count: 0, item, totalValue: 0 });
        }
        const current = itemCounts.get(key)!;
        current.count++;
        current.totalValue += Number(item.price) || 0;
      });

      // Pagination
      const itemsPerPage = 10;
      const items = Array.from(itemCounts.entries());
      const totalPages = Math.ceil(items.length / itemsPerPage);

      if (page > totalPages && totalPages > 0) {
        return this.createGeneralError("Invalid Page", `Page ${page} does not exist. Total pages: ${totalPages}`);
      }

      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageItems = items.slice(startIndex, endIndex);

      // Calculate total inventory value
      const totalValue = items.reduce((sum, [, data]) => sum + data.totalValue, 0);

      // Create inventory embed
      const inventoryText = pageItems
        .map(([itemKey, data], index) => {
          const displayIndex = startIndex + index + 1;
          const itemName = data.item.name || data.item.itemId || "Unknown Item";
          const purchaseDate = data.item.purchasedAt ? new Date(data.item.purchasedAt).toLocaleDateString() : "Unknown";

          return (
            `**${displayIndex}.** ${itemName}\n` +
            `📦 Quantity: ${data.count}x\n` +
            `💰 Total Value: ${data.totalValue} coins\n` +
            `📅 First Purchase: ${purchaseDate}`
          );
        })
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`🎒 ${this.formatUserDisplay(targetUser)}'s Inventory`)
        .setDescription(inventoryText || "No items to display")
        .setColor("#9932cc")
        .addFields(
          {
            name: "📊 Inventory Stats",
            value:
              `**Total Items:** ${inventory.length}\n` +
              `**Unique Items:** ${items.length}\n` +
              `**Total Value:** ${totalValue} coins`,
            inline: true,
          },
          {
            name: "💰 Economy Stats",
            value:
              `**Balance:** ${userEconomy.balance.toString()} coins\n` +
              `**Bank:** ${userEconomy.bank.toString()} coins\n` +
              `**Level:** ${userEconomy.level} (${userEconomy.xp} XP)`,
            inline: true,
          }
        )
        .setFooter({
          text: `Page ${page}/${totalPages} • Requested by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add thumbnail if viewing own inventory
      if (targetUser.id === this.user.id) {
        embed.setThumbnail(targetUser.displayAvatarURL());
      }

      await this.logCommandUsage("inventory", {
        target: targetUser.id,
        page,
        itemCount: inventory.length,
        totalValue,
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing inventory command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while fetching inventory information. Please try again."
      );
    }
  }
}

export default new InventoryCommand();

export const builder = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("View your inventory of purchased items")
  .addUserOption((option) =>
    option.setName("user").setDescription("The user whose inventory to view").setRequired(false)
  )
  .addIntegerOption((option) =>
    option.setName("page").setDescription("The page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  );
