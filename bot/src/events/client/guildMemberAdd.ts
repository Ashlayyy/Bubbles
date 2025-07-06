import { EmbedBuilder, Events, GuildMember, TextChannel } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildMemberAdd, async (member: GuildMember) => {
  const client = await Client.get();
  const config = client.config;
  const guildConfig = await getGuildConfig(member.guild.id);

  // Calculate account age
  const accountCreated = member.user.createdAt;
  const accountAgeMs = Date.now() - accountCreated.getTime();
  const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
  const accountAgeFormatted =
    accountAgeDays < 30 ? `${String(accountAgeDays)} days` : `${String(Math.floor(accountAgeDays / 30))} months`;

  // Check if this might be a suspicious account
  const isSuspiciousAccount = accountAgeDays < 7; // Account created less than a week ago

  // Enhanced logging for member join
  await client.logManager.log(member.guild.id, "MEMBER_JOIN", {
    userId: member.id,
    metadata: {
      username: member.user.username,
      discriminator: member.user.discriminator,
      displayName: member.displayName,
      accountCreated: accountCreated.toISOString(),
      accountAge: accountAgeFormatted,
      accountAgeDays: accountAgeDays,
      isSuspiciousAccount: isSuspiciousAccount,
      memberCount: member.guild.memberCount,
      avatar: member.user.displayAvatarURL(),
      joinedAt: new Date().toISOString(),
      isBot: member.user.bot,
      hasNitro: member.user.banner || member.user.avatarDecorationData ? true : false,
      timestamp: new Date().toISOString(),
    },
  });

  // Continue with welcome message logic
  if (!guildConfig.welcomeEnabled || !guildConfig.welcomeChannelId) return;

  const welcomeChannel = member.guild.channels.cache.get(guildConfig.welcomeChannelId);
  if (!welcomeChannel || !(welcomeChannel instanceof TextChannel)) {
    logger.warn(`Welcome channel with ID ${guildConfig.welcomeChannelId} not found or is not a text channel.`);
    return;
  }

  const messages = config.welcome?.messages ?? [];
  if (messages.length === 0) return;

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  const embed = new EmbedBuilder()
    .setTitle(randomMessage.title.replace("{server}", member.guild.name).replace("{user}", member.displayName))
    .setDescription(
      randomMessage.description.replace("{server}", member.guild.name).replace("{user}", member.displayName)
    )
    .setColor(randomMessage.color as `#${string}`)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  void welcomeChannel.send({ embeds: [embed] });
});
