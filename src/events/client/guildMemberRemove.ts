import { EmbedBuilder, Events, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
  const client = await Client.get();
  const config = client.config;
  const guildConfig = await getGuildConfig(member.guild.id);

  // Enhanced logging for member leave
  const timeInServer = member.joinedAt ? Date.now() - member.joinedAt.getTime() : null;
  const timeInServerFormatted = timeInServer
    ? timeInServer < 1000 * 60 * 60 * 24
      ? `${Math.floor(timeInServer / (1000 * 60 * 60))} hours`
      : `${Math.floor(timeInServer / (1000 * 60 * 60 * 24))} days`
    : "Unknown";

  await client.logManager.log(member.guild.id, "MEMBER_LEAVE", {
    userId: member.id,
    metadata: {
      username: member.user.username,
      discriminator: member.user.discriminator,
      displayName: member.displayName || "Unknown",
      joinedAt: member.joinedAt?.toISOString(),
      leftAt: new Date().toISOString(),
      timeInServer: timeInServerFormatted,
      timeInServerMs: timeInServer,
      memberCount: member.guild.memberCount,
      roles: member.roles.cache.map((role) => ({ id: role.id, name: role.name })),
      nickname: member.nickname,
      avatar: member.user.displayAvatarURL(),
      wasKicked: false, // This will be updated by audit log listeners if needed
      wasBanned: false, // This will be updated by audit log listeners if needed
      timestamp: new Date().toISOString(),
    },
  });

  // Continue with goodbye message logic
  if (!config.goodbye?.enabled || !guildConfig.goodbyeChannelId) return;

  const goodbyeChannel = member.guild.channels.cache.get(guildConfig.goodbyeChannelId);
  if (!goodbyeChannel || !(goodbyeChannel instanceof TextChannel)) {
    logger.warn(`Goodbye channel with ID ${guildConfig.goodbyeChannelId} not found or is not a text channel.`);
    return;
  }

  const messages = config.goodbye.messages;
  if (messages.length === 0) return;

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  const embed = new EmbedBuilder()
    .setTitle(randomMessage.title.replace("{server}", member.guild.name).replace("{user}", member.displayName))
    .setDescription(
      randomMessage.description.replace("{server}", member.guild.name).replace("{user}", member.displayName)
    )
    .setColor(randomMessage.color as `#${string}`)
    .setThumbnail(member.user.displayAvatarURL() || member.guild.iconURL())
    .setTimestamp();

  void goodbyeChannel.send({ embeds: [embed] });
});
