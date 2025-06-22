import { ChannelType, EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import type { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("ADMIN ONLY: Configure welcome system for new members")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up welcome/goodbye channels")
        .addChannelOption((opt) =>
          opt
            .setName("welcome_channel")
            .setDescription("Channel for welcome messages")
            .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption((opt) =>
          opt
            .setName("goodbye_channel")
            .setDescription("Channel for goodbye messages")
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption((opt) => opt.setName("welcome_enabled").setDescription("Enable welcome messages"))
        .addBooleanOption((opt) => opt.setName("goodbye_enabled").setDescription("Enable goodbye messages"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Test welcome/goodbye messages")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Message type to test")
            .setRequired(true)
            .addChoices({ name: "Welcome Message", value: "welcome" }, { name: "Goodbye Message", value: "goodbye" })
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("View current welcome/goodbye configuration")),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      await handleSetup(client, interaction);
    } else if (subcommand === "test") {
      await handleTest(client, interaction);
    } else if (subcommand === "status") {
      await handleStatus(client, interaction);
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);

async function handleSetup(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const welcomeChannel = interaction.options.getChannel("welcome_channel");
  const goodbyeChannel = interaction.options.getChannel("goodbye_channel");
  const welcomeEnabled = interaction.options.getBoolean("welcome_enabled");
  const goodbyeEnabled = interaction.options.getBoolean("goodbye_enabled");

  try {
    // Get or create guild config
    const guildConfig = await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    // Update channel and enabled settings
    const updateData: {
      welcomeChannelId?: string | null;
      goodbyeChannelId?: string | null;
      welcomeEnabled?: boolean;
      goodbyeEnabled?: boolean;
    } = {};

    if (welcomeChannel !== null) {
      updateData.welcomeChannelId = welcomeChannel.id;
    }

    if (goodbyeChannel !== null) {
      updateData.goodbyeChannelId = goodbyeChannel.id;
    }

    if (welcomeEnabled !== null) {
      updateData.welcomeEnabled = welcomeEnabled;
    }

    if (goodbyeEnabled !== null) {
      updateData.goodbyeEnabled = goodbyeEnabled;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.guildConfig.update({
        where: { id: guildConfig.id },
        data: updateData,
      });

      // Notify API of welcome system configuration change
      const customClient = client as any as Client;
      if (customClient.queueService) {
        try {
          await customClient.queueService.processRequest({
            type: "CONFIG_UPDATE",
            data: {
              guildId: interaction.guild.id,
              section: "WELCOME_SYSTEM",
              changes: updateData,
              action: "UPDATE_WELCOME_CONFIG",
              updatedBy: interaction.user.id,
            },
            source: "rest",
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            requiresReliability: true,
          });
        } catch (error) {
          console.warn("Failed to notify API of welcome system change:", error);
        }
      }
    }

    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ Welcome System Configured").setTimestamp();

    const fields: { name: string; value: string; inline: boolean }[] = [];

    if (welcomeChannel) {
      fields.push({
        name: "👋 Welcome Channel",
        value: `<#${welcomeChannel.id}>`,
        inline: true,
      });
    }

    if (goodbyeChannel) {
      fields.push({
        name: "👋 Goodbye Channel",
        value: `<#${goodbyeChannel.id}>`,
        inline: true,
      });
    }

    if (welcomeEnabled !== null) {
      fields.push({
        name: "🎉 Welcome Messages",
        value: welcomeEnabled ? "Enabled" : "Disabled",
        inline: true,
      });
    }

    if (goodbyeEnabled !== null) {
      fields.push({
        name: "😢 Goodbye Messages",
        value: goodbyeEnabled ? "Enabled" : "Disabled",
        inline: true,
      });
    }

    if (fields.length === 0) {
      embed.setDescription("No changes were made. Use the options to configure the welcome system.");
    } else {
      embed.addFields(fields);
      embed.setDescription(
        "Welcome/goodbye system has been updated! Messages are configured in the bot's config file."
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Log configuration change
    await client.logManager.log(interaction.guild.id, "WELCOME_CONFIG", {
      userId: interaction.user.id,
      metadata: {
        welcomeChannel: welcomeChannel?.id,
        goodbyeChannel: goodbyeChannel?.id,
        welcomeEnabled,
        goodbyeEnabled,
      },
    });
  } catch (error) {
    logger.error("Error configuring welcome system:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to configure welcome system. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleStatus(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    const embed = new EmbedBuilder().setColor(0x3498db).setTitle("📊 Welcome System Status").setTimestamp();

    const fields: { name: string; value: string; inline: boolean }[] = [];

    // Show channel configuration from database
    fields.push({
      name: "👋 Welcome Channel",
      value: guildConfig?.welcomeChannelId ? `<#${guildConfig.welcomeChannelId}>` : "Not set",
      inline: true,
    });

    fields.push({
      name: "👋 Goodbye Channel",
      value: guildConfig?.goodbyeChannelId ? `<#${guildConfig.goodbyeChannelId}>` : "Not set",
      inline: true,
    });

    // Show enabled/disabled status from database
    const welcomeMessages = client.config.welcome?.messages.length ?? 0;
    const goodbyeMessages = client.config.goodbye?.messages.length ?? 0;
    const welcomeEnabled = guildConfig?.welcomeEnabled ?? true;
    const goodbyeEnabled = guildConfig?.goodbyeEnabled ?? true;

    fields.push({
      name: "🎉 Welcome Messages",
      value: welcomeEnabled ? `✅ Enabled (${welcomeMessages} messages)` : "❌ Disabled",
      inline: true,
    });

    fields.push({
      name: "😢 Goodbye Messages",
      value: goodbyeEnabled ? `✅ Enabled (${goodbyeMessages} messages)` : "❌ Disabled",
      inline: true,
    });

    embed.addFields(fields);

    if (!guildConfig?.welcomeChannelId && !guildConfig?.goodbyeChannelId) {
      embed.setDescription("⚠️ No channels configured. Use `/welcome setup` to set up channels.");
    } else {
      embed.setDescription(
        "📝 Messages are configured in the bot's config file. Enable/disable and channels are set per server."
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error getting welcome status:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to get welcome system status.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleTest(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const type = interaction.options.getString("type", true);

  try {
    // Get guild config to check if the feature is enabled
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });

    const isEnabled =
      type === "welcome" ? (guildConfig?.welcomeEnabled ?? true) : (guildConfig?.goodbyeEnabled ?? true);

    if (!isEnabled) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle("⚠️ Feature Disabled")
            .setDescription(`${type.charAt(0).toUpperCase() + type.slice(1)} messages are disabled for this server.`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const config = type === "welcome" ? client.config.welcome : client.config.goodbye;
    const messages = config?.messages ?? [];

    if (messages.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle("⚠️ No Messages")
            .setDescription(`No ${type} messages are configured in the bot's config file.`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Pick a random message
    const message = messages[Math.floor(Math.random() * messages.length)];

    // Replace variables
    const processedTitle = message.title
      .replace(/\{user\}/g, `<@${interaction.user.id}>`)
      .replace(/\{server\}/g, interaction.guild.name)
      .replace(/\{membercount\}/g, interaction.guild.memberCount.toString());

    const processedDescription = message.description
      .replace(/\{user\}/g, `<@${interaction.user.id}>`)
      .replace(/\{server\}/g, interaction.guild.name)
      .replace(/\{membercount\}/g, interaction.guild.memberCount.toString());

    const embed = new EmbedBuilder()
      .setTitle(processedTitle)
      .setDescription(processedDescription)
      .setColor(parseInt(message.color.replace("#", ""), 16))
      .setTimestamp()
      .setFooter({ text: `Test ${type} message` });

    await interaction.reply({
      embeds: [embed],
      content: `🧪 **Test ${type.charAt(0).toUpperCase() + type.slice(1)} Message:**`,
    });
  } catch (error) {
    logger.error(`Error testing ${type} message:`, error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription(`Failed to test ${type} message. Please try again.`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}
