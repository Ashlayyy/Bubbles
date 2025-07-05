// LevelingService handles per-guild XP gain, cooldowns, level-up detection, and rewards
// Uses Redis for cooldown & XP counters so data survives restarts.
// XP formula: level = floor(Math.sqrt(xp / 100))  (15 XP per message by default)
import type { Message } from "discord.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cooldownStore } from "../utils/CooldownStore.js";

// Reuse root logger with child metadata
const loggerChild = logger.child({ component: "leveling-service" });

export class LevelingService {
  private static instance: LevelingService;
  private readonly XP_PER_MESSAGE = 15;
  private readonly DEFAULT_COOLDOWN_MS = 60_000; // 60s

  static getInstance(): LevelingService {
    if (!LevelingService.instance) LevelingService.instance = new LevelingService();
    return LevelingService.instance;
  }

  private constructor() {
    /* singleton */
  }

  /** Handle a new guild message – award XP if cooldown passed */
  async handleMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    // Cool-down check (guild+user level)
    const allowed = await cooldownStore.requestToken({
      userId,
      guildId,
      commandName: "xp",
      cooldownMs: this.DEFAULT_COOLDOWN_MS,
    });

    if (!allowed) return; // Ignore XP award – cooldown active

    try {
      const xpKey = `xpTotal:${guildId}:${userId}`;
      // Increment XP atomically in Redis and get new total
      const redis = (cooldownStore as any).redis; // expose internal redis (hacky but fine for now)
      const newTotal = await redis.incrby(xpKey, this.XP_PER_MESSAGE);

      // Set a very long expiry (90 days) so keys eventually disappear for inactive users
      await redis.expire(xpKey, 60 * 60 * 24 * 90);

      const prevLevel = this.calculateLevel(newTotal - this.XP_PER_MESSAGE);
      const newLevel = this.calculateLevel(newTotal);

      if (newLevel > prevLevel) {
        await this.onLevelUp(message, newLevel, newTotal);
      }
    } catch (error) {
      loggerChild.error("Error awarding XP:", error);
    }
  }

  private calculateLevel(totalXp: number): number {
    return Math.floor(Math.sqrt(totalXp / 100));
  }

  private async onLevelUp(message: Message, level: number, totalXp: number): Promise<void> {
    const guildId = message.guild!.id;
    const userId = message.author.id;

    // Record level-up history
    try {
      await prisma.levelHistory.create({
        data: {
          guildId,
          userId,
          level,
        },
      });
    } catch (err) {
      loggerChild.warn("Failed to write LevelHistory:", err);
    }

    // Assign role reward if configured
    try {
      const reward = await prisma.levelReward.findFirst({
        where: { guildId, level },
      });
      if (reward && message.member) {
        await message.member.roles.add(reward.roleId, `Level ${level} reward`);
      }
    } catch (err) {
      loggerChild.warn("Failed to assign level reward:", err);
    }

    // Send level-up message to same channel if it supports sending
    if ("send" in message.channel) {
      const channelToSend = message.channel as unknown as { send: (options: any) => Promise<any> };
      await channelToSend.send({
        content: `🎉 <@${userId}> just reached level **${level}**! (${totalXp} XP)`,
      });
    }
  }
}

export const levelingService = LevelingService.getInstance();
