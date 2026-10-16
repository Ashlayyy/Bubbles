import type { Message, TextBasedChannel } from "discord.js";

import { prisma } from "../database/index.js";

const DEFAULT_SETTINGS = {
  enabled: true,
  xpPerMessage: 15,
  xpCooldown: 60,
  levelUpMessage: "Congratulations {user}! You reached level {level}!",
  levelUpChannel: null as string | null,
  ignoredChannels: [] as string[],
  ignoredRoles: [] as string[],
  noXpRoles: [] as string[],
};

const cooldowns = new Map<string, number>();

function xpForLevel(level: number): number {
  return level * level * 100;
}

function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export async function awardMessageXp(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const stored =
    config?.levelingSettings && typeof config.levelingSettings === "object"
      ? (config.levelingSettings as Record<string, unknown>)
      : {};
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  if (!settings.enabled) return;
  if (settings.ignoredChannels.includes(message.channel.id)) return;

  const member = message.member ?? (await message.guild.members.fetch(userId).catch(() => null));
  if (member) {
    const blocked = [...settings.ignoredRoles, ...settings.noXpRoles];
    if (blocked.some((roleId) => member.roles.cache.has(roleId))) return;
  }

  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;
  if (now - last < settings.xpCooldown * 1000) return;
  cooldowns.set(key, now);

  const existing = await prisma.userXp.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  const xp = (existing?.xp ?? 0) + settings.xpPerMessage;
  const level = levelFromXp(xp);
  const previousLevel = existing?.level ?? 0;

  await prisma.userXp.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: {
      guildId,
      userId,
      xp,
      level,
      messages: 1,
    },
    update: {
      xp,
      level,
      messages: { increment: 1 },
    },
  });

  if (level <= previousLevel || !settings.levelUpMessage) return;

  const text = String(settings.levelUpMessage)
    .replaceAll("{user}", `<@${userId}>`)
    .replaceAll("{level}", String(level))
    .replaceAll("{xp}", String(xp))
    .replaceAll("{xpToNext}", String(Math.max(0, xpForLevel(level + 1) - xp)));

  const targetId = settings.levelUpChannel || message.channel.id;
  const channel = (await message.guild.channels.fetch(targetId).catch(() => null)) as TextBasedChannel | null;
  if (channel && "send" in channel) {
    await channel.send({ content: text }).catch(() => undefined);
  }
}
