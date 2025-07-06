// LevelingService handles per-guild XP gain, cooldowns, level-up detection, and rewards
// Uses Redis for cooldown & XP counters so data survives restarts.
// XP formula: level = floor(Math.sqrt(xp / 100))  (15 XP per message by default)
import type { Message, VoiceState } from "discord.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cooldownStore } from "../utils/CooldownStore.js";

// Reuse root logger with child metadata
const loggerChild = logger.child({ component: "leveling-service" });

export class LevelingService {
  private static instance: LevelingService;
  private readonly XP_PER_MESSAGE = 15;
  private readonly XP_PER_VOICE_MINUTE = 2;
  private readonly DEFAULT_COOLDOWN_MS = 60_000; // 60s
  private readonly VOICE_XP_INTERVAL_MS = 60_000; // Award voice XP every minute
  private voiceSessions = new Map<string, { startTime: number; lastXpAward: number }>();

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

      // Sync with database (upsert UserEconomy record)
      await this.syncUserEconomyData(guildId, userId, newTotal, newLevel);

      if (newLevel > prevLevel) {
        await this.onLevelUp(message, newLevel, newTotal);
      }
    } catch (error) {
      loggerChild.error("Error awarding XP:", error);
    }
  }

  /** Handle voice state changes for XP tracking */
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const userId = member.id;
    const sessionKey = `${guildId}:${userId}`;

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      this.voiceSessions.set(sessionKey, {
        startTime: Date.now(),
        lastXpAward: Date.now(),
      });
      loggerChild.debug(`Voice session started for ${userId} in guild ${guildId}`);
    }
    // User left a voice channel
    else if (oldState.channel && !newState.channel) {
      const session = this.voiceSessions.get(sessionKey);
      if (session) {
        // Award final XP for remaining time
        await this.awardVoiceXP(guildId, userId, session);
        this.voiceSessions.delete(sessionKey);
        loggerChild.debug(`Voice session ended for ${userId} in guild ${guildId}`);
      }
    }
  }

  /** Award XP for voice activity */
  private async awardVoiceXP(
    guildId: string,
    userId: string,
    session: { startTime: number; lastXpAward: number }
  ): Promise<void> {
    const now = Date.now();
    const timeSinceLastAward = now - session.lastXpAward;

    // Only award XP if enough time has passed
    if (timeSinceLastAward < this.VOICE_XP_INTERVAL_MS) return;

    const minutesInVoice = Math.floor(timeSinceLastAward / this.VOICE_XP_INTERVAL_MS);
    const xpToAward = minutesInVoice * this.XP_PER_VOICE_MINUTE;

    if (xpToAward <= 0) return;

    try {
      const xpKey = `xpTotal:${guildId}:${userId}`;
      const redis = (cooldownStore as any).redis;
      const newTotal = await redis.incrby(xpKey, xpToAward);

      // Set expiry
      await redis.expire(xpKey, 60 * 60 * 24 * 90);

      const prevLevel = this.calculateLevel(newTotal - xpToAward);
      const newLevel = this.calculateLevel(newTotal);

      // Update session
      session.lastXpAward = now;

      // Sync with database
      await this.syncUserEconomyData(guildId, userId, newTotal, newLevel);

      if (newLevel > prevLevel) {
        await this.onVoiceLevelUp(guildId, userId, newLevel, newTotal);
      }

      loggerChild.debug(`Awarded ${xpToAward} voice XP to ${userId} in guild ${guildId}`);
    } catch (error) {
      loggerChild.error("Error awarding voice XP:", error);
    }
  }

  /** Process voice XP for all active sessions */
  async processVoiceXP(): Promise<void> {
    const promises = Array.from(this.voiceSessions.entries()).map(([sessionKey, session]) => {
      const [guildId, userId] = sessionKey.split(":");
      return this.awardVoiceXP(guildId, userId, session);
    });

    await Promise.allSettled(promises);
  }

  private calculateLevel(totalXp: number): number {
    return Math.floor(Math.sqrt(totalXp / 100));
  }

  /** Sync Redis XP data with UserEconomy database */
  private async syncUserEconomyData(guildId: string, userId: string, totalXP: number, level: number): Promise<void> {
    try {
      await prisma.userEconomy.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        update: {
          xp: totalXP,
          level,
          updatedAt: new Date(),
        },
        create: {
          guildId,
          userId,
          xp: totalXP,
          level,
          balance: BigInt(0),
          bank: BigInt(0),
          lastDaily: null,
          streak: 0,
          inventory: "[]",
        },
      });
    } catch (error) {
      loggerChild.warn("Failed to sync UserEconomy data:", error);
    }
  }

  /** Get user's total XP from Redis with database fallback */
  async getUserXP(guildId: string, userId: string): Promise<{ xp: number; level: number }> {
    try {
      const redis = (cooldownStore as any).redis;
      const xpKey = `xpTotal:${guildId}:${userId}`;

      // Try Redis first
      const redisXP = await redis.get(xpKey);
      if (redisXP !== null) {
        const xp = parseInt(redisXP, 10);
        const level = this.calculateLevel(xp);
        return { xp, level };
      }

      // Fallback to database
      const userEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      if (userEconomy) {
        const xp = userEconomy.xp;
        const level = userEconomy.level;

        // Restore to Redis for future access
        await redis.setex(xpKey, 60 * 60 * 24 * 90, xp);

        return { xp, level };
      }

      return { xp: 0, level: 1 };
    } catch (error) {
      loggerChild.error("Error getting user XP:", error);
      return { xp: 0, level: 1 };
    }
  }

  /** Sync all Redis XP data with database (periodic maintenance) */
  async syncAllUserData(guildId?: string): Promise<void> {
    try {
      const redis = (cooldownStore as any).redis;
      const pattern = guildId ? `xpTotal:${guildId}:*` : "xpTotal:*";
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        loggerChild.info("No XP keys found to sync");
        return;
      }

      loggerChild.info(`Syncing ${keys.length} XP records to database`);

      for (const key of keys) {
        try {
          const [, keyGuildId, keyUserId] = key.split(":");
          const xp = await redis.get(key);

          if (xp !== null) {
            const totalXP = parseInt(xp, 10);
            const level = this.calculateLevel(totalXP);
            await this.syncUserEconomyData(keyGuildId, keyUserId, totalXP, level);
          }
        } catch (error) {
          loggerChild.warn(`Failed to sync key ${key}:`, error);
        }
      }

      loggerChild.info(`Completed syncing ${keys.length} XP records`);
    } catch (error) {
      loggerChild.error("Error syncing all user data:", error);
    }
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

  private async onVoiceLevelUp(guildId: string, userId: string, level: number, totalXp: number): Promise<void> {
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
      if (reward) {
        // Get guild and member to assign role
        const guild = await prisma.user.findFirst(); // We'll need to get guild from Discord API
        loggerChild.info(`User ${userId} reached level ${level} through voice activity in guild ${guildId}`);
        // Note: Role assignment from voice level-up requires Discord API access
        // For now, we'll log it and let the next message level-up handle role assignment
      }
    } catch (err) {
      loggerChild.warn("Failed to assign voice level reward:", err);
    }

    loggerChild.info(`🎉 User ${userId} reached level ${level} through voice activity! (${totalXp} XP)`);
  }
}

export const levelingService = LevelingService.getInstance();
