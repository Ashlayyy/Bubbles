import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../../../shared/src/database.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class TransferCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "transfer",
      description: "Transfer coins to another user",
      category: "economy",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const guildId = this.guild.id;
    const fromUserId = this.user.id;
    const toUser = this.getUserOption("user", true);
    const amount = this.getIntegerOption("amount", true);

    // Validation
    if (amount <= 0) {
      return this.createGeneralError("Invalid Amount", "Amount must be greater than 0.");
    }

    if (amount > 1000000) {
      return this.createGeneralError("Invalid Amount", "Amount cannot exceed 1,000,000 coins.");
    }

    if (toUser.id === fromUserId) {
      return this.createGeneralError("Invalid Transfer", "You cannot transfer coins to yourself.");
    }

    if (toUser.bot) {
      return this.createGeneralError("Invalid Transfer", "You cannot transfer coins to a bot.");
    }

    try {
      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Get sender's economy data
        let fromEconomy = await tx.userEconomy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId: fromUserId,
            },
          },
        });

        // Create default economy if doesn't exist
        if (!fromEconomy) {
          fromEconomy = await tx.userEconomy.create({
            data: {
              guildId,
              userId: fromUserId,
              balance: BigInt(100), // Starting balance
              bank: BigInt(0),
              xp: 0,
              level: 1,
              streak: 0,
              inventory: [],
            },
          });
        }

        // Check if sender has enough balance
        if (Number(fromEconomy.balance) < amount) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        // Get receiver's economy data
        let toEconomy = await tx.userEconomy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId: toUser.id,
            },
          },
        });

        // Create default economy if doesn't exist
        if (!toEconomy) {
          toEconomy = await tx.userEconomy.create({
            data: {
              guildId,
              userId: toUser.id,
              balance: BigInt(100), // Starting balance
              bank: BigInt(0),
              xp: 0,
              level: 1,
              streak: 0,
              inventory: [],
            },
          });
        }

        // Update sender's balance
        const updatedFromEconomy = await tx.userEconomy.update({
          where: {
            guildId_userId: {
              guildId,
              userId: fromUserId,
            },
          },
          data: {
            balance: fromEconomy.balance - BigInt(amount),
          },
        });

        // Update receiver's balance
        const updatedToEconomy = await tx.userEconomy.update({
          where: {
            guildId_userId: {
              guildId,
              userId: toUser.id,
            },
          },
          data: {
            balance: toEconomy.balance + BigInt(amount),
          },
        });

        // Create transaction records
        await tx.economyTransaction.create({
          data: {
            guildId,
            userId: fromUserId,
            type: "transfer",
            amount: BigInt(-amount),
            reason: `Transferred to ${toUser.username}`,
            metadata: {
              toUserId: toUser.id,
              toUsername: toUser.username,
            },
          },
        });

        await tx.economyTransaction.create({
          data: {
            guildId,
            userId: toUser.id,
            type: "transfer",
            amount: BigInt(amount),
            reason: `Received from ${this.user.username}`,
            metadata: {
              fromUserId: fromUserId,
              fromUsername: this.user.username,
            },
          },
        });

        return { updatedFromEconomy, updatedToEconomy };
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("💸 Transfer Successful!")
        .setDescription(`Successfully transferred **${amount} coins** to ${this.formatUserDisplay(toUser)}`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "💰 Amount Transferred",
            value: `${amount} coins`,
            inline: true,
          },
          {
            name: "📤 From",
            value: this.formatUserDisplay(this.user),
            inline: true,
          },
          {
            name: "📥 To",
            value: this.formatUserDisplay(toUser),
            inline: true,
          },
          {
            name: "💳 Your New Balance",
            value: `${result.updatedFromEconomy.balance.toString()} coins`,
            inline: true,
          },
          {
            name: "💳 Their New Balance",
            value: `${result.updatedToEconomy.balance.toString()} coins`,
            inline: true,
          },
          {
            name: "📋 Transaction ID",
            value: `TXN-${Date.now().toString(36).toUpperCase()}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Transfer by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

      await this.logCommandUsage("transfer", { amount, toUserId: toUser.id });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing transfer command:", error);

      if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") {
        return this.createGeneralError("Insufficient Funds", "You don't have enough coins to make this transfer.");
      }

      return this.createGeneralError("Error", "An error occurred while processing the transfer. Please try again.");
    }
  }
}

export default new TransferCommand();

export const builder = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Transfer coins to another user")
  .addUserOption((option) => option.setName("user").setDescription("The user to transfer coins to").setRequired(true))
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription("The amount of coins to transfer")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000000)
  );
