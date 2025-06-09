import { EmbedBuilder, Events, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
  const client = await Client.get();
  const config = client.config;
  const guildConfig = await getGuildConfig(member.guild.id);

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
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  void goodbyeChannel.send({ embeds: [embed] });
});
