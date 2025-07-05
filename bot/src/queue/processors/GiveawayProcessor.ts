import type { GiveawayJob } from "@shared/types/queue";
import type { Guild, TextChannel } from "discord.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

interface GiveawayEntry {
  userId: string;
  id: string;
}

interface GiveawayData {
  id: string;
  isActive: boolean;
  hasEnded: boolean;
  prize: string;
  winnersCount: number;
  winners: string[];
  entries: GiveawayEntry[];
}

interface GiveawayResult {
  winnerIds?: string[];
  winnerCount?: number;
  endedAt?: number;
  rerolled?: boolean;
}

export class GiveawayProcessor extends BaseProcessor<GiveawayJob> {
  constructor(client: Client) {
    super(client, "GiveawayProcessor");
  }

  getJobTypes(): string[] {
    return ["END_GIVEAWAY", "REROLL_GIVEAWAY"];
  }

  async processJob(job: GiveawayJob): Promise<ProcessorResult> {
    const { type, giveawayId, giveawayDbId, messageId, channelId, guildId } = job;

    if (!guildId) {
      return {
        success: false,
        error: "Guild ID is required for giveaway actions",
        timestamp: Date.now(),
      };
    }

    if (!channelId || !messageId) {
      return {
        success: false,
        error: "Channel ID and Message ID are required for giveaway actions",
        timestamp: Date.now(),
      };
    }

    try {
      const guild = await this.fetchGuild(guildId);
      const channel = await this.fetchChannel(channelId);

      if (!channel?.isTextBased()) {
        return {
          success: false,
          error: "Channel is not a text channel",
          timestamp: Date.now(),
        };
      }

      let result: GiveawayResult;

      switch (type) {
        case "END_GIVEAWAY":
          result = await this.endGiveaway(guild, channel as TextChannel, messageId, giveawayDbId);
          break;
        case "REROLL_GIVEAWAY":
          result = await this.rerollGiveaway(guild, channel as TextChannel, messageId, giveawayDbId);
          break;
        default:
          return {
            success: false,
            error: `Unknown giveaway action type: ${type}`,
            timestamp: Date.now(),
          };
      }

      return {
        success: true,
        data: {
          type,
          giveawayId,
          giveawayDbId,
          messageId,
          channelId,
          guildId,
          result,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  private async endGiveaway(
    guild: Guild,
    channel: TextChannel,
    messageId: string,
    giveawayDbId: string
  ): Promise<GiveawayResult> {
    try {
      // Fetch the giveaway message
      const message = await channel.messages.fetch(messageId);

      // Get giveaway data from database
      const { prisma } = await import("../../database/index.js");
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayDbId },
      });

      if (!giveaway) {
        throw new Error("Giveaway not found in database");
      }

      // Get users who reacted with the giveaway emoji
      const reactions = message.reactions.cache.get("🎉");
      if (!reactions) {
        throw new Error("No reactions found on giveaway message");
      }

      const users = await reactions.users.fetch();
      const validUsers = users.filter((user) => !user.bot && user.id !== this.client.user?.id);

      if (validUsers.size === 0) {
        throw new Error("No valid participants found");
      }

      // Select random winners
      const winnerCount = Math.min(giveaway.winnersCount, validUsers.size);
      const winners = validUsers.random(winnerCount);
      const winnerArray = Array.isArray(winners) ? winners : [winners];
      const winnerIds = winnerArray.map((user) => user.id);

      // Update giveaway in database
      await prisma.giveaway.update({
        where: { id: giveawayDbId },
        data: {
          hasEnded: true,
          winners: winnerIds,
          endedAt: new Date(),
        },
      });

      // Update the message
      const winnerMentions = winnerArray.map((user) => `<@${user.id}>`).join(", ");
      await message.edit({
        content: `🎉 **GIVEAWAY ENDED** 🎉\n\n**${giveaway.prize}**\n\n**Winners:** ${winnerMentions}\n**Hosted by:** <@${giveaway.hostId}>`,
        components: [],
      });

      // Send winner announcement
      await channel.send({
        content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
      });

      return {
        winnerIds,
        winnerCount,
        endedAt: Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to end giveaway: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async rerollGiveaway(
    guild: Guild,
    channel: TextChannel,
    messageId: string,
    giveawayDbId: string
  ): Promise<GiveawayResult> {
    try {
      // Fetch the giveaway message
      const message = await channel.messages.fetch(messageId);

      // Get giveaway data from database
      const { prisma } = await import("../../database/index.js");
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayDbId },
      });

      if (!giveaway) {
        throw new Error("Giveaway not found in database");
      }

      if (!giveaway.hasEnded) {
        throw new Error("Cannot reroll an active giveaway");
      }

      // Get users who reacted with the giveaway emoji
      const reactions = message.reactions.cache.get("🎉");
      if (!reactions) {
        throw new Error("No reactions found on giveaway message");
      }

      const users = await reactions.users.fetch();
      const validUsers = users.filter((user) => !user.bot && user.id !== this.client.user?.id);

      if (validUsers.size === 0) {
        throw new Error("No valid participants found for reroll");
      }

      // Select new random winners
      const winnerCount = Math.min(giveaway.winnersCount, validUsers.size);
      const winners = validUsers.random(winnerCount);
      const winnerArray = Array.isArray(winners) ? winners : [winners];
      const winnerIds = winnerArray.map((user) => user.id);

      // Update giveaway in database
      await prisma.giveaway.update({
        where: { id: giveawayDbId },
        data: {
          winners: winnerIds,
          endedAt: new Date(),
        },
      });

      // Send reroll announcement
      const winnerMentions = winnerArray.map((user) => `<@${user.id}>`).join(", ");
      await channel.send({
        content: `🎉 **GIVEAWAY REROLLED** 🎉\n\nNew winners for **${giveaway.prize}**: ${winnerMentions}!`,
      });

      return {
        winnerIds,
        winnerCount,
        endedAt: Date.now(),
        rerolled: true,
      };
    } catch (error) {
      throw new Error(`Failed to reroll giveaway: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  protected getEventPrefix(): string {
    return "GIVEAWAY";
  }

  protected getAdditionalEventData(job: GiveawayJob): Record<string, unknown> {
    return {
      ...super.getAdditionalEventData(job),
      giveawayAction: job.type,
      giveawayId: job.giveawayId,
      giveawayDbId: job.giveawayDbId,
      messageId: job.messageId,
      channelId: job.channelId,
    };
  }
}
