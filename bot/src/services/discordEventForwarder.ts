import { Events } from "discord.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import type { WebSocketService } from "./websocketService.js";

export class DiscordEventForwarder {
  private client: Client;
  private wsService: WebSocketService;

  constructor(client: Client, wsService: WebSocketService) {
    this.client = client;
    this.wsService = wsService;
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    // Member events
    this.client.on(Events.GuildMemberAdd, (member) => {
      this.wsService.sendDiscordEvent(
        "guildMemberAdd",
        {
          userId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          joinedAt: member.joinedAt?.toISOString(),
          accountCreated: member.user.createdAt.toISOString(),
          isBot: member.user.bot,
          avatar: member.user.displayAvatarURL(),
          memberCount: member.guild.memberCount,
        },
        member.guild.id
      );
    });

    this.client.on(Events.GuildMemberRemove, (member) => {
      this.wsService.sendDiscordEvent(
        "guildMemberRemove",
        {
          userId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          leftAt: new Date().toISOString(),
          memberCount: member.guild.memberCount,
        },
        member.guild.id
      );
    });

    this.client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      this.wsService.sendDiscordEvent(
        "guildMemberUpdate",
        {
          userId: newMember.id,
          username: newMember.user.username,
          before: {
            displayName: oldMember.displayName,
            roles: oldMember.roles.cache.map((role) => ({ id: role.id, name: role.name })),
            nickname: oldMember.nickname,
          },
          after: {
            displayName: newMember.displayName,
            roles: newMember.roles.cache.map((role) => ({ id: role.id, name: role.name })),
            nickname: newMember.nickname,
          },
        },
        newMember.guild.id
      );
    });

    // Message events
    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot) return; // Don't forward bot messages

      this.wsService.sendDiscordEvent(
        "messageCreate",
        {
          messageId: message.id,
          channelId: message.channelId,
          authorId: message.author.id,
          authorUsername: message.author.username,
          content: message.content,
          attachments: message.attachments.map((att) => ({
            id: att.id,
            name: att.name,
            url: att.url,
            size: att.size,
          })),
          embeds: message.embeds.length,
          timestamp: message.createdAt.toISOString(),
        },
        message.guildId ?? undefined
      );
    });

    this.client.on(Events.MessageDelete, (message) => {
      this.wsService.sendDiscordEvent(
        "messageDelete",
        {
          messageId: message.id,
          channelId: message.channelId,
          authorId: message.author?.id,
          authorUsername: message.author?.username,
          content: message.content,
          deletedAt: new Date().toISOString(),
        },
        message.guildId ?? undefined
      );
    });

    this.client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
      this.wsService.sendDiscordEvent(
        "messageUpdate",
        {
          messageId: newMessage.id,
          channelId: newMessage.channelId,
          authorId: newMessage.author.id,
          authorUsername: newMessage.author.username,
          before: {
            content: oldMessage.content,
            editedAt: oldMessage.editedAt?.toISOString(),
          },
          after: {
            content: newMessage.content,
            editedAt: newMessage.editedAt?.toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        newMessage.guildId ?? undefined
      );
    });

    // Ban events
    this.client.on(Events.GuildBanAdd, (ban) => {
      this.wsService.sendDiscordEvent(
        "guildBanAdd",
        {
          userId: ban.user.id,
          username: ban.user.username,
          reason: ban.reason,
          bannedAt: new Date().toISOString(),
        },
        ban.guild.id
      );
    });

    this.client.on(Events.GuildBanRemove, (ban) => {
      this.wsService.sendDiscordEvent(
        "guildBanRemove",
        {
          userId: ban.user.id,
          username: ban.user.username,
          unbannedAt: new Date().toISOString(),
        },
        ban.guild.id
      );
    });

    // Guild events
    this.client.on(Events.GuildCreate, (guild) => {
      this.wsService.sendDiscordEvent(
        "guildCreate",
        {
          guildId: guild.id,
          guildName: guild.name,
          memberCount: guild.memberCount,
          ownerId: guild.ownerId,
          createdAt: guild.createdAt.toISOString(),
          joinedAt: new Date().toISOString(),
        },
        guild.id
      );
    });

    this.client.on(Events.GuildDelete, (guild) => {
      this.wsService.sendDiscordEvent(
        "guildDelete",
        {
          guildId: guild.id,
          guildName: guild.name,
          leftAt: new Date().toISOString(),
        },
        guild.id
      );
    });

    // Voice events
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      this.wsService.sendDiscordEvent(
        "voiceStateUpdate",
        {
          userId: newState.id,
          username: newState.member?.user.username,
          before: {
            channelId: oldState.channelId,
            channelName: oldState.channel?.name,
            muted: oldState.mute,
            deafened: oldState.deaf,
          },
          after: {
            channelId: newState.channelId,
            channelName: newState.channel?.name,
            muted: newState.mute,
            deafened: newState.deaf,
          },
        },
        newState.guild.id
      );
    });

    // Role events
    this.client.on(Events.GuildRoleCreate, (role) => {
      this.wsService.sendDiscordEvent(
        "guildRoleCreate",
        {
          roleId: role.id,
          roleName: role.name,
          roleColor: role.hexColor,
          permissions: role.permissions.toArray(),
          createdAt: new Date().toISOString(),
        },
        role.guild.id
      );
    });

    this.client.on(Events.GuildRoleDelete, (role) => {
      this.wsService.sendDiscordEvent(
        "guildRoleDelete",
        {
          roleId: role.id,
          roleName: role.name,
          deletedAt: new Date().toISOString(),
        },
        role.guild.id
      );
    });

    this.client.on(Events.GuildRoleUpdate, (oldRole, newRole) => {
      this.wsService.sendDiscordEvent(
        "guildRoleUpdate",
        {
          roleId: newRole.id,
          before: {
            name: oldRole.name,
            color: oldRole.hexColor,
            permissions: oldRole.permissions.toArray(),
          },
          after: {
            name: newRole.name,
            color: newRole.hexColor,
            permissions: newRole.permissions.toArray(),
          },
        },
        newRole.guild.id
      );
    });

    // Channel events
    this.client.on(Events.ChannelCreate, (channel) => {
      if (!channel.isDMBased()) {
        this.wsService.sendDiscordEvent(
          "channelCreate",
          {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type,
            createdAt: new Date().toISOString(),
          },
          channel.guildId
        );
      }
    });

    this.client.on(Events.ChannelDelete, (channel) => {
      if (!channel.isDMBased()) {
        this.wsService.sendDiscordEvent(
          "channelDelete",
          {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type,
            deletedAt: new Date().toISOString(),
          },
          channel.guildId
        );
      }
    });

    // Reaction events
    this.client.on(Events.MessageReactionAdd, (reaction, user) => {
      this.wsService.sendDiscordEvent(
        "messageReactionAdd",
        {
          messageId: reaction.message.id,
          channelId: reaction.message.channelId,
          userId: user.id,
          username: user.username,
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
            animated: reaction.emoji.animated,
          },
          reactionCount: reaction.count,
        },
        reaction.message.guildId ?? undefined
      );
    });

    this.client.on(Events.MessageReactionRemove, (reaction, user) => {
      this.wsService.sendDiscordEvent(
        "messageReactionRemove",
        {
          messageId: reaction.message.id,
          channelId: reaction.message.channelId,
          userId: user.id,
          username: user.username,
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
            animated: reaction.emoji.animated,
          },
          reactionCount: reaction.count,
        },
        reaction.message.guildId ?? undefined
      );
    });

    logger.info("Discord event forwarding setup complete");
  }
}
