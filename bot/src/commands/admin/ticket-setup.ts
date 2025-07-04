import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { getGuildConfig, updateGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

// Type guard to ensure string is not null/undefined
function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export const builder = new SlashCommandBuilder()
  .setName("ticket-setup")
  .setDescription("Configure the ticket system for this server")
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Set the channel where users can create tickets")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for ticket creation")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("threads")
      .setDescription("Configure whether to use threads or separate channels")
      .addBooleanOption((opt) =>
        opt.setName("enabled").setDescription("Use threads for tickets (recommended: true)").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("oncall")
      .setDescription("Set the role to ping when new tickets are created")
      .addRoleOption((opt) => opt.setName("role").setDescription("Role to ping for new tickets").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("category")
      .setDescription("Set category for ticket channels (only if not using threads)")
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("Category for ticket channels")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("panel").setDescription("Create/update the ticket creation panel in the configured channel")
  )
  .addSubcommand((sub) => sub.setName("status").setDescription("View current ticket system configuration"))
  .addSubcommand((sub) =>
    sub
      .setName("silent-claim")
      .setDescription("Configure whether staff can claim tickets silently")
      .addBooleanOption((opt) =>
        opt.setName("enabled").setDescription("Allow silent ticket claiming (default: true)").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("access-type")
      .setDescription("Choose how to determine who gets access to tickets")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Access control method")
          .setRequired(true)
          .addChoices({ name: "Role-based", value: "role" }, { name: "Permission-based", value: "permission" })
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("access-role")
      .setDescription("Set the role that gets access to all tickets")
      .addRoleOption((opt) => opt.setName("role").setDescription("Role to grant ticket access").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("access-permission")
      .setDescription("Set the Discord permission required for ticket access")
      .addStringOption((opt) =>
        opt
          .setName("permission")
          .setDescription("Required Discord permission")
          .setRequired(true)
          .addChoices(
            { name: "Manage Messages", value: "ManageMessages" },
            { name: "Manage Channels", value: "ManageChannels" },
            { name: "Manage Members", value: "ManageMembers" },
            { name: "Ban Members", value: "BanMembers" },
            { name: "Kick Members", value: "KickMembers" },
            { name: "Moderate Members", value: "ModerateMembers" }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("logging-channel")
      .setDescription("Configure channel for ticket event logging")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Channel to log ticket events to").setRequired(true)
      )
  );

class TicketSetupCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ticket-setup",
      description: "Configure the ticket system for this server",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        isConfigurable: false,
      },
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.interaction.guild || !this.interaction.isChatInputCommand()) {
      return {};
    }

    const member = this.interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await this.interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ No Permission")
            .setDescription("You need Administrator permissions to configure the ticket system.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return {};
    }

    const subcommand = this.interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "channel":
          await handleChannelSetup(this.client, this.interaction);
          break;
        case "threads":
          await handleThreadsConfig(this.client, this.interaction);
          break;
        case "oncall":
          await handleOnCallConfig(this.client, this.interaction);
          break;
        case "category":
          await handleCategoryConfig(this.client, this.interaction);
          break;
        case "panel":
          await handlePanelCreation(this.client, this.interaction);
          break;
        case "status":
          await handleStatusDisplay(this.client, this.interaction);
          break;
        case "silent-claim":
          await handleSilentClaimConfig(this.client, this.interaction);
          break;
        case "access-type":
          await handleAccessTypeConfig(this.client, this.interaction);
          break;
        case "access-role":
          await handleAccessRoleConfig(this.client, this.interaction);
          break;
        case "access-permission":
          await handleAccessPermissionConfig(this.client, this.interaction);
          break;
        case "logging-channel":
          await handleLoggingChannelConfig(this.client, this.interaction);
          break;
      }
    } catch (error) {
      logger.error("Error in ticket-setup command:", error);
      await this.interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to configure ticket system. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    return {};
  }
}

export default new TicketSetupCommand();

async function handleChannelSetup(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  // Check if bot has required permissions in the channel
  const clientUserId = client.user?.id;
  if (!clientUserId) {
    await interaction.reply({
      content: "❌ Bot user ID not available. Please try again.",
      ephemeral: true,
    });
    return;
  }

  const botMember = interaction.guild.members.cache.get(clientUserId);

  // Type guard to ensure we have a guild channel with permissions
  const guildChannel = interaction.guild.channels.cache.get(channel.id);
  const channelPerms = botMember && guildChannel ? guildChannel.permissionsFor(botMember) : null;

  if (
    !botMember ||
    !channelPerms?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.CreatePublicThreads,
    ])
  ) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Missing Permissions")
          .setDescription(
            `I need the following permissions in <#${channel.id}>:\n` +
              "• View Channel\n" +
              "• Send Messages\n" +
              "• Embed Links\n" +
              "• Create Public Threads"
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, {
    ticketChannelId: channel.id,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "channelId",
          value: channel.id,
          action: "UPDATE_TICKET_CHANNEL",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket channel change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Ticket Channel Set")
        .setDescription(`Ticket creation channel set to <#${channel.id}>`)
        .addFields({
          name: "Next Steps",
          value:
            "• Configure threads: `/ticket-setup threads`\n• Set oncall role: `/ticket-setup oncall`\n• Create panel: `/ticket-setup panel`",
          inline: false,
        })
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    channelId: channel.id,
    metadata: {
      configType: "channel",
      newValue: channel.id,
    },
  });
}

async function handleThreadsConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean("enabled", true);

  await updateGuildConfig(interaction.guild.id, {
    useTicketThreads: enabled,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "useThreads",
          value: enabled,
          action: "UPDATE_TICKET_THREADS",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket threads config change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Thread Configuration Updated")
        .setDescription(
          enabled
            ? "Tickets will now use **threads** (recommended)\n\n" +
                "**Benefits:**\n" +
                "• Cleaner server organization\n" +
                "• Better Discord thread features\n" +
                "• Automatic archiving"
            : "Tickets will now use **separate channels**\n\n" +
                "**Note:** You'll need to set a category with `/ticket-setup category`"
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "threads",
      newValue: enabled,
    },
  });
}

async function handleOnCallConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const role = interaction.options.getRole("role");
  const roleId = role?.id ?? null;

  await updateGuildConfig(interaction.guild.id, {
    ticketOnCallRoleId: roleId,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "onCallRole",
          value: roleId,
          action: "UPDATE_TICKET_ONCALL_ROLE",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket on-call role change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ On-Call Role Updated")
        .setDescription(role ? `On-call role set to ${role.name}` : "On-call role **removed**")
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "oncall",
      newValue: roleId,
    },
  });
}

async function handleCategoryConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const category = interaction.options.getChannel("category", true);

  // Check current thread setting
  const config = await getGuildConfig(interaction.guild.id);
  if (config.useTicketThreads) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⚠️ Threads Enabled")
          .setDescription(
            "You currently have threads enabled for tickets.\n\n" +
              "Categories are only used when threads are disabled.\n" +
              "Disable threads first with `/ticket-setup threads enabled:false`"
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, {
    ticketCategoryId: category.id,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "categoryId",
          value: category.id,
          action: "UPDATE_TICKET_CATEGORY",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket category change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Ticket Category Set")
        .setDescription(`Ticket channels will be created in ${category.name}`)
        .addFields({
          name: "Channel Setup",
          value: "New ticket channels will inherit permissions from this category",
          inline: false,
        })
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "category",
      newValue: category.id,
    },
  });
}

async function handlePanelCreation(
  client: Client,
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const config = await getGuildConfig(interaction.guild.id);

  if (!config.ticketChannelId) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ No Ticket Channel")
          .setDescription("Please set a ticket channel first with `/ticket-setup channel`")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (!config.ticketChannelId) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ No Ticket Channel")
          .setDescription("Please set a ticket channel first with `/ticket-setup channel`")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Use string literal to bypass Prisma type issues
  const channelId = String(config.ticketChannelId);
  const ticketChannel = interaction.guild.channels.cache.get(channelId);
  if (!ticketChannel?.isTextBased()) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Channel Not Found")
          .setDescription(
            "The configured ticket channel no longer exists or is not a text channel. Please set a new one."
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Create the ticket panel embed
  const panelEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🎫 Support Tickets")
    .setDescription(
      "Need help? Create a support ticket and our staff will assist you!\n\n" +
        "**What to include:**\n" +
        "• Clear description of your issue\n" +
        "• Screenshots or evidence if applicable"
    )
    .addFields({
      name: "📋 Categories",
      value:
        "**General Support** - General questions and help\n" +
        "**Technical Issue** - Bot or server problems\n" +
        "**Report User** - Report rule violations\n" +
        "**Suggestion** - Suggest improvements",
      inline: false,
    })
    .setTimestamp();

  // Create the ticket creation button
  const ticketButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("🎫 Create Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫")
  );

  try {
    await ticketChannel.send({
      embeds: [panelEmbed],
      components: [ticketButton],
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Ticket Panel Created")
          .setDescription(`Ticket panel has been posted in <#${ticketChannel.id}>`)
          .addFields({
            name: "Configuration",
            value:
              `**Channel:** <#${ticketChannel.id}>\n` +
              `**Threads:** ${config.useTicketThreads ? "Enabled" : "Disabled"}\n` +
              `**On-Call Role:** ${config.ticketOnCallRoleId ? `<@&${config.ticketOnCallRoleId}>` : "None"}`,
            inline: false,
          })
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // Log panel creation
    await client.logManager.log(interaction.guild.id, "TICKET_PANEL_CREATE", {
      userId: interaction.user.id,
      channelId: ticketChannel.id,
      metadata: {
        useThreads: Boolean(config.useTicketThreads),
        onCallRole: config.ticketOnCallRoleId ? String(config.ticketOnCallRoleId) : undefined,
      },
    });
  } catch (error) {
    logger.error("Error creating ticket panel:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Panel Creation Failed")
          .setDescription("Failed to create ticket panel. Check bot permissions in the channel.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleStatusDisplay(_client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const config = await getGuildConfig(interaction.guild.id);

  const statusEmbed = new EmbedBuilder().setColor(0x3498db).setTitle("🎫 Ticket System Configuration").setTimestamp();

  // Channel configuration
  const ticketChannel = config.ticketChannelId
    ? interaction.guild.channels.cache.get(String(config.ticketChannelId))
    : null;

  statusEmbed.addFields({
    name: "📍 Ticket Channel",
    value: ticketChannel ? `<#${ticketChannel.id}> ✅` : "Not configured ❌",
    inline: true,
  });

  // Thread configuration
  statusEmbed.addFields({
    name: "🧵 Use Threads",
    value: config.useTicketThreads ? "Enabled ✅" : "Disabled",
    inline: true,
  });

  // On-call role
  const onCallRole = config.ticketOnCallRoleId
    ? interaction.guild.roles.cache.get(String(config.ticketOnCallRoleId))
    : null;

  statusEmbed.addFields({
    name: "🚨 On-Call Role",
    value: onCallRole ? `${onCallRole.name} ✅` : "Not configured",
    inline: true,
  });

  // Silent claim configuration
  statusEmbed.addFields({
    name: "🤫 Silent Claims",
    value: config.ticketSilentClaim ? "Enabled ✅" : "Disabled",
    inline: true,
  });

  // Access control configuration
  if (config.ticketAccessType) {
    if (config.ticketAccessType === "role" && config.ticketAccessRoleId) {
      const roleId = String(config.ticketAccessRoleId);
      const accessRole = interaction.guild.roles.cache.get(roleId);
      statusEmbed.addFields({
        name: "🔐 Access Control",
        value: accessRole ? `Role: ${accessRole.name} ✅` : "Role not found ❌",
        inline: true,
      });
    } else if (config.ticketAccessType === "permission" && config.ticketAccessPermission) {
      const permissionNames: Record<string, string> = {
        ManageMessages: "Manage Messages",
        ManageChannels: "Manage Channels",
        ManageMembers: "Manage Members",
        BanMembers: "Ban Members",
        KickMembers: "Kick Members",
        ModerateMembers: "Moderate Members",
        Administrator: "Administrator",
      };
      const permissionKey = String(config.ticketAccessPermission);
      const friendlyName = permissionNames[permissionKey] || permissionKey;
      statusEmbed.addFields({
        name: "🔐 Access Control",
        value: `Permission: ${friendlyName} ✅`,
        inline: true,
      });
    } else {
      statusEmbed.addFields({
        name: "🔐 Access Control",
        value: "Partially configured ⚠️",
        inline: true,
      });
    }
  } else {
    statusEmbed.addFields({
      name: "🔐 Access Control",
      value: "Not configured",
      inline: true,
    });
  }

  // Category (if not using threads)
  if (!config.useTicketThreads) {
    const category = config.ticketCategoryId
      ? interaction.guild.channels.cache.get(String(config.ticketCategoryId))
      : null;

    statusEmbed.addFields({
      name: "📂 Category",
      value: category ? `${category.name} ✅` : "Not configured ❌",
      inline: true,
    });
  }

  // Setup status
  const isConfigured = Boolean(config.ticketChannelId && (config.useTicketThreads || config.ticketCategoryId));

  statusEmbed.setDescription(
    isConfigured
      ? "✅ **Ticket system is configured and ready!**\n\nUsers can create tickets in the configured channel."
      : "⚠️ **Ticket system needs configuration**\n\nPlease complete the setup to enable tickets."
  );

  if (!isConfigured) {
    statusEmbed.addFields({
      name: "🔧 Setup Steps",
      value:
        "1. `/ticket-setup channel` - Set ticket creation channel\n" +
        "2. `/ticket-setup threads` - Configure thread usage\n" +
        "3. `/ticket-setup oncall` - Set on-call role (optional)\n" +
        "4. `/ticket-setup panel` - Create ticket panel",
      inline: false,
    });
  }

  await interaction.reply({
    embeds: [statusEmbed],
    ephemeral: true,
  });
}

async function handleSilentClaimConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean("enabled", true);

  await updateGuildConfig(interaction.guild.id, {
    ticketSilentClaim: enabled,
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Silent Claim Configuration Updated")
        .setDescription(
          enabled
            ? "Staff can now **claim tickets silently** by default\n\n" +
                "**Benefits:**\n" +
                "• Less notification spam in tickets\n" +
                "• Staff can optionally choose to announce claims\n" +
                "• Use `/ticket claim silent:false` to announce a claim"
            : "Staff will now **announce all ticket claims** by default\n\n" +
                "**Note:** Staff can still use `/ticket claim silent:true` to claim silently"
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "silent-claim",
      newValue: enabled,
    },
  });
}

async function handleAccessTypeConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const accessType = interaction.options.getString("type", true) as "role" | "permission";

  await updateGuildConfig(interaction.guild.id, {
    ticketAccessType: accessType,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "accessType",
          value: accessType,
          action: "UPDATE_TICKET_ACCESS_TYPE",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket access type change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Access Type Updated")
        .setDescription(
          accessType === "role"
            ? "Ticket access is now **role-based**\n\n" +
                "**Next step:** Set the access role with `/ticket-setup access-role`"
            : "Ticket access is now **permission-based**\n\n" +
                "**Next step:** Set the required permission with `/ticket-setup access-permission`"
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "access-type",
      newValue: accessType,
    },
  });
}

async function handleAccessRoleConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const role = interaction.options.getRole("role", true);

  // Check if access type is set to role
  const config = await getGuildConfig(interaction.guild.id);
  if (config.ticketAccessType !== "role") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⚠️ Access Type Not Set")
          .setDescription(
            "Please set access type to **role-based** first:\n" + "`/ticket-setup access-type type:Role-based`"
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, {
    ticketAccessRoleId: role.id,
  });

  // Notify API of ticket configuration change
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "accessRoleId",
          value: role.id,
          roleName: role.name,
          action: "UPDATE_TICKET_ACCESS_ROLE",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch (error) {
      console.warn("Failed to notify API of ticket access role change:", error);
    }
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Access Role Updated")
        .setDescription(
          `Users with the **${role.name}** role will now have access to all tickets.\n\n` +
            "**Note:** This applies to new tickets. Existing tickets won't be affected."
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "access-role",
      newValue: role.id,
      roleName: role.name,
    },
  });
}

async function handleAccessPermissionConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const permission = interaction.options.getString("permission", true);

  // Check if access type is set to permission
  const config = await getGuildConfig(interaction.guild.id);
  if (config.ticketAccessType !== "permission") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⚠️ Access Type Not Set")
          .setDescription(
            "Please set access type to **permission-based** first:\n" +
              "`/ticket-setup access-type type:Permission-based`"
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, {
    ticketAccessPermission: permission,
  });

  // Convert permission to friendly name
  const permissionNames: Record<string, string> = {
    ManageMessages: "Manage Messages",
    ManageChannels: "Manage Channels",
    ManageMembers: "Manage Members",
    BanMembers: "Ban Members",
    KickMembers: "Kick Members",
    ModerateMembers: "Moderate Members",
    Administrator: "Administrator",
  };

  const friendlyName = permissionNames[permission] ?? permission;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Access Permission Updated")
        .setDescription(
          `Users with the **${friendlyName}** permission will now have access to all tickets.\n\n` +
            "**Note:** This applies to new tickets. Existing tickets won't be affected."
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    metadata: {
      configType: "access-permission",
      newValue: permission,
      friendlyName,
    },
  });
}

async function handleLoggingChannelConfig(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  // Validate channel type - resolve the guild channel first
  const resolvedChannel = interaction.guild.channels.cache.get(channel.id);
  if (!resolvedChannel?.isTextBased()) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Invalid Channel")
          .setDescription("Please select a text channel for ticket logging.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check bot permissions in the channel
  const clientUserId = client.user?.id;
  if (!clientUserId) {
    await interaction.reply({
      content: "❌ Bot user ID not available. Please try again.",
      ephemeral: true,
    });
    return;
  }

  const botMember = interaction.guild.members.cache.get(clientUserId);
  const guildChannel = interaction.guild.channels.cache.get(channel.id);
  const channelPerms = botMember && guildChannel ? guildChannel.permissionsFor(botMember) : null;

  if (
    !botMember ||
    !channelPerms?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])
  ) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Missing Permissions")
          .setDescription(
            `I need the following permissions in <#${channel.id}>:\n` +
              "• View Channel\n" +
              "• Send Messages\n" +
              "• Embed Links"
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, {
    ticketLogChannelId: channel.id,
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Ticket Logging Channel Set")
        .setDescription(
          `Ticket events will now be logged to <#${channel.id}>\n\n` +
            "**What will be logged:**\n" +
            "• Ticket creation\n" +
            "• Ticket closing\n" +
            "• Ticket claiming\n" +
            "• Ticket assignment\n" +
            "• Other ticket events"
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Log the configuration change
  await client.logManager.log(interaction.guild.id, "TICKET_CONFIG_CHANGE", {
    userId: interaction.user.id,
    channelId: channel.id,
    metadata: {
      configType: "logging-channel",
      newValue: channel.id,
      channelName: channel.name,
    },
  });
}

// Ticket Setup Wizard
export async function startTicketWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const wizardEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🎫 Ticket Setup Wizard")
    .setDescription(
      "Welcome to the **Ticket System Setup Wizard**!\n\n" +
        "Follow the steps below to configure tickets for your server.\n\n" +
        "• **Select Ticket Channel** – Where users press the create-ticket button.\n" +
        "• **Toggle Threads** – Decide whether each ticket is a thread or its own channel.\n" +
        "• **Create Panel** – Post the " +
        "ticket creation panel in the configured channel."
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Channel: ${config.ticketChannelId ? `<#${config.ticketChannelId}>` : "Not set"}` +
          `\n• Threads: ${config.useTicketThreads ? "Enabled" : "Disabled"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select a channel (dropdown below).\n" +
          "2. Toggle threads if desired.\n" +
          "3. Press **Create Panel** when ready.",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("ticket_channel_select")
    .setPlaceholder("Select ticket channel")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const threadButton = new ButtonBuilder()
    .setCustomId(config.useTicketThreads ? "ticket_disable_threads" : "ticket_enable_threads")
    .setLabel(config.useTicketThreads ? "Disable Threads" : "Enable Threads")
    .setStyle(ButtonStyle.Secondary);

  const panelButton = new ButtonBuilder()
    .setCustomId("ticket_create_panel")
    .setLabel("Create Panel")
    .setStyle(ButtonStyle.Success);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    new ActionRowBuilder<ButtonBuilder>().addComponents(threadButton, panelButton),
  ];

  await interaction.reply({ embeds: [wizardEmbed], components: components, ephemeral: true });

  const collector = interaction.channel?.createMessageComponentCollector({
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (interactionComponent) => {
    void (async () => {
      try {
        if (interactionComponent.isChannelSelectMenu() && interactionComponent.customId === "ticket_channel_select") {
          const menu = interactionComponent;
          const selectedChannelId = menu.values[0];
          if (!selectedChannelId) {
            await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyTicketChannel(client, menu, selectedChannelId);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "ticket_enable_threads":
              await applyTicketThreads(client, btn, true);
              break;
            case "ticket_disable_threads":
              await applyTicketThreads(client, btn, false);
              break;
            case "ticket_create_panel":
              await handlePanelCreation(client, btn);
              break;
          }
        }
      } catch (error) {
        logger.error("Ticket wizard error:", error);
        if (!interactionComponent.replied && !interactionComponent.deferred) {
          await interactionComponent.reply({ content: "❌ An error occurred.", ephemeral: true });
        }
      }
    })();
  });

  collector?.on("end", () => void 0);
}

async function applyTicketChannel(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Please select a text channel.", ephemeral: true });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({ content: "❌ Bot user not found in guild.", ephemeral: true });
    return;
  }
  const perms = channel.permissionsFor(botMember);
  if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    await interaction.reply({
      content: `❌ I need **View Channel**, **Send Messages**, and **Embed Links** in <#${channel.id}> to work properly.`,
      ephemeral: true,
    });
    return;
  }

  await updateGuildConfig(interaction.guild.id, { ticketChannelId: channel.id });

  // Notify queue service if available
  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "channelId",
          value: channel.id,
          action: "UPDATE_TICKET_CHANNEL",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch {
      /* ignore */
    }
  }

  await interaction.reply({
    content: `✅ Ticket channel set to <#${channel.id}>`,
    ephemeral: true,
  });
}

async function applyTicketThreads(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  await updateGuildConfig(interaction.guild.id, { useTicketThreads: enabled });

  const customClient = client;
  if (customClient.queueService) {
    try {
      customClient.queueService.processRequest({
        type: "CONFIG_UPDATE",
        data: {
          guildId: interaction.guild.id,
          section: "TICKET_SYSTEM",
          setting: "useThreads",
          value: enabled,
          action: "UPDATE_TICKET_THREADS",
          updatedBy: interaction.user.id,
        },
        source: "rest",
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        requiresReliability: true,
      });
    } catch {
      /* ignore */
    }
  }

  await interaction.reply({
    content: `✅ Tickets will now use ${enabled ? "threads" : "separate channels"}.`,
    ephemeral: true,
  });
}
