import { prisma } from "@shared/database.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ShopCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "shop",
      description: "View and purchase items from the economy shop",
      category: "economy",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const guildId = this.guild.id;
    const action = this.getStringOption("action") || "view";
    const itemId = this.getStringOption("item");
    const quantity = this.getIntegerOption("quantity") || 1;

    if (action === "buy") {
      if (!itemId) {
        return this.createGeneralError("Invalid Purchase", "Please specify an item to buy.");
      }

      return await this.handlePurchase(guildId, itemId, quantity);
    } else {
      return await this.handleViewShop(guildId);
    }
  }

  private async handleViewShop(guildId: string): Promise<CommandResponse> {
    try {
      const shopItems = await prisma.economyShop.findMany({
        where: { guildId, enabled: true },
        orderBy: { category: "asc" },
      });

      if (shopItems.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("🏪 Economy Shop")
              .setDescription("The shop is currently empty! Come back later.")
              .setColor("#ffa500")
              .setTimestamp(),
          ],
          ephemeral: true,
        };
      }

      // Group items by category
      const categories = new Map<string, typeof shopItems>();
      shopItems.forEach((item) => {
        if (!categories.has(item.category)) {
          categories.set(item.category, []);
        }
        categories.get(item.category)!.push(item);
      });

      const embed = new EmbedBuilder()
        .setTitle("🏪 Economy Shop")
        .setDescription("Purchase items with your coins!")
        .setColor("#00ff00")
        .setTimestamp();

      // Add fields for each category
      for (const [category, items] of categories) {
        const itemText = items
          .map((item) => {
            const stockText = item.stock ? ` (${item.stock} left)` : "";
            return `\`${item.itemId}\` - **${item.name}**\n${item.description}\n💰 ${item.price} coins${stockText}`;
          })
          .join("\n\n");

        embed.addFields({
          name: `📦 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
          value: itemText.length > 1024 ? itemText.substring(0, 1021) + "..." : itemText,
          inline: false,
        });
      }

      embed.addFields({
        name: "💳 How to Buy",
        value: "Use `/shop action:buy item:<item_id> quantity:<amount>` to purchase items!",
        inline: false,
      });

      await this.logCommandUsage("shop", { action: "view", itemCount: shopItems.length });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error viewing shop:", error);
      return this.createGeneralError("Error", "An error occurred while loading the shop. Please try again.");
    }
  }

  private async handlePurchase(guildId: string, itemId: string, quantity: number): Promise<CommandResponse> {
    const userId = this.user.id;

    // Validate quantity
    if (quantity <= 0) {
      return this.createGeneralError("Invalid Quantity", "Quantity must be greater than 0.");
    }

    if (quantity > 100) {
      return this.createGeneralError("Invalid Quantity", "Cannot purchase more than 100 items at once.");
    }

    try {
      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Get shop item
        const shopItem = await tx.economyShop.findUnique({
          where: {
            guildId_itemId: {
              guildId,
              itemId,
            },
          },
        });

        if (!shopItem?.enabled) {
          throw new Error("ITEM_NOT_FOUND");
        }

        // Check stock
        if (shopItem.stock !== null && shopItem.stock < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Calculate total cost
        const totalCost = Number(shopItem.price.toString()) * quantity;

        // Get user economy data
        let userEconomy = await tx.userEconomy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
        });

        // Create default economy if doesn't exist
        if (!userEconomy) {
          userEconomy = await tx.userEconomy.create({
            data: {
              guildId,
              userId,
              balance: BigInt(100), // Starting balance
              bank: BigInt(0),
              xp: 0,
              level: 1,
              streak: 0,
              inventory: [],
            },
          });
        }

        // Check if user has enough balance
        if (Number(userEconomy.balance) < totalCost) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        // Update user balance
        const updatedEconomy = await tx.userEconomy.update({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          data: {
            balance: userEconomy.balance - BigInt(totalCost),
            inventory: {
              push: Array(quantity).fill({
                itemId: shopItem.itemId,
                name: shopItem.name,
                purchasedAt: new Date(),
                price: shopItem.price,
              }),
            },
          },
        });

        // Update shop stock
        if (shopItem.stock !== null) {
          await tx.economyShop.update({
            where: {
              guildId_itemId: {
                guildId,
                itemId,
              },
            },
            data: {
              stock: shopItem.stock - quantity,
            },
          });
        }

        // Create transaction record
        await tx.economyTransaction.create({
          data: {
            guildId,
            userId,
            type: "spend",
            amount: BigInt(-totalCost),
            reason: `Purchased ${quantity}x ${shopItem.name}`,
            metadata: {
              itemId: shopItem.itemId,
              itemName: shopItem.name,
              quantity,
              unitPrice: shopItem.price.toString(),
              totalCost,
            },
          },
        });

        return { shopItem, totalCost, updatedEconomy };
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🛒 Purchase Successful!")
        .setDescription(`You purchased **${quantity}x ${result.shopItem.name}**!`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "🛍️ Item",
            value: result.shopItem.name,
            inline: true,
          },
          {
            name: "🔢 Quantity",
            value: quantity.toString(),
            inline: true,
          },
          {
            name: "💰 Total Cost",
            value: `${result.totalCost} coins`,
            inline: true,
          },
          {
            name: "💳 New Balance",
            value: `${result.updatedEconomy.balance.toString()} coins`,
            inline: true,
          },
          {
            name: "🎒 Inventory",
            value: `${Array.isArray(result.updatedEconomy.inventory) ? result.updatedEconomy.inventory.length : 0} items`,
            inline: true,
          },
          {
            name: "📋 Transaction ID",
            value: `PUR-${Date.now().toString(36).toUpperCase()}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Purchase by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

      await this.logCommandUsage("shop", { action: "buy", itemId, quantity, totalCost: result.totalCost });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error purchasing item:", error);

      if (error instanceof Error) {
        switch (error.message) {
          case "ITEM_NOT_FOUND":
            return this.createGeneralError(
              "Item Not Found",
              "The specified item was not found or is no longer available."
            );
          case "INSUFFICIENT_STOCK":
            return this.createGeneralError(
              "Insufficient Stock",
              "There isn't enough stock available for this quantity."
            );
          case "INSUFFICIENT_FUNDS":
            return this.createGeneralError("Insufficient Funds", "You don't have enough coins to make this purchase.");
        }
      }

      return this.createGeneralError("Error", "An error occurred while processing your purchase. Please try again.");
    }
  }
}

export default new ShopCommand();

export const builder = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("View and purchase items from the economy shop")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(false)
      .addChoices({ name: "View Shop", value: "view" }, { name: "Buy Item", value: "buy" })
  )
  .addStringOption((option) =>
    option.setName("item").setDescription("Item ID to purchase (required for buying)").setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("quantity")
      .setDescription("Quantity to purchase (default: 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  );
