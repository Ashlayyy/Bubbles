import { EmbedBuilder, Events, GuildMember, TextChannel } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildMemberAdd, async (member: GuildMember) => {
  const client = await Client.get();
  const config = client.config;
  const guildConfig = await getGuildConfig(member.guild.id);

  if (!config.welcome?.enabled || !guildConfig.welcomeChannelId) return;

  const welcomeChannel = member.guild.channels.cache.get(guildConfig.welcomeChannelId as string);
  if (!welcomeChannel || !(welcomeChannel instanceof TextChannel)) {
    logger.warn(`Welcome channel with ID ${guildConfig.welcomeChannelId} not found or is not a text channel.`);
    return;
  }

  const messages = config.welcome.messages;
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
