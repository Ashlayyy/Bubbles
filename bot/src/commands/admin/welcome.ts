import { ChannelType, EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Welcome Command - Configure welcome system for new members
 */
export class WelcomeCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "welcome",
      description: "ADMIN ONLY: Configure welcome system for new members",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        discordPermissions: [PermissionsBitField.Flags.Administrator],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    try {
      switch (subcommand) {
        case "setup":
          return await this.handleSetup();
        case "test":
          return await this.handleTest();
        case "status":
          return await this.handleStatus();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in welcome command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleSetup(): Promise<CommandResponse> {
    const welcomeChannel = this.getChannelOption("welcome_channel");
    const goodbyeChannel = this.getChannelOption("goodbye_channel");
    const welcomeEnabled = this.getBooleanOption("welcome_enabled");
    const goodbyeEnabled = this.getBooleanOption("goodbye_enabled");

    try {
      // Get or create guild config
      const guildConfig = await prisma.guildConfig.upsert({
        where: { guildId: this.guild.id },
        update: {},
        create: { guildId: this.guild.id },
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
        const customClient = this.client as any as Client;
        if (customClient.queueService) {
          try {
            await customClient.queueService.processRequest({
              type: "CONFIG_UPDATE",
              data: {
                guildId: this.guild.id,
                section: "WELCOME_SYSTEM",
                changes: updateData,
                action: "UPDATE_WELCOME_CONFIG",
                updatedBy: this.user.id,
              },
              source: "rest",
              userId: this.user.id,
              guildId: this.guild.id,
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

      // Log configuration change
      await this.client.logManager.log(this.guild.id, "WELCOME_CONFIG", {
        userId: this.user.id,
        metadata: {
          welcomeChannel: welcomeChannel?.id,
          goodbyeChannel: goodbyeChannel?.id,
          welcomeEnabled,
          goodbyeEnabled,
        },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error setting up welcome system:", error);
      return {
        content: `❌ Failed to configure welcome system: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleStatus(): Promise<CommandResponse> {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📊 Welcome System Status")
        .setTimestamp()
        .setFooter({ text: `Server: ${this.guild.name}` });

      if (!guildConfig) {
        embed.setDescription("❌ Welcome system is not configured for this server.");
        embed.addFields({
          name: "💡 Getting Started",
          value: "Use `/welcome setup` to configure the welcome system.",
          inline: false,
        });

        return { embeds: [embed], ephemeral: true };
      }

      const fields: { name: string; value: string; inline: boolean }[] = [];

      // Welcome channel status
      if (guildConfig.welcomeChannelId) {
        const channel = this.guild.channels.cache.get(guildConfig.welcomeChannelId);
        fields.push({
          name: "👋 Welcome Channel",
          value: channel
            ? `<#${guildConfig.welcomeChannelId}> ✅`
            : `~~<#${guildConfig.welcomeChannelId}>~~ ❌ (Deleted)`,
          inline: true,
        });
      } else {
        fields.push({
          name: "👋 Welcome Channel",
          value: "Not configured",
          inline: true,
        });
      }

      // Goodbye channel status
      if (guildConfig.goodbyeChannelId) {
        const channel = this.guild.channels.cache.get(guildConfig.goodbyeChannelId);
        fields.push({
          name: "👋 Goodbye Channel",
          value: channel
            ? `<#${guildConfig.goodbyeChannelId}> ✅`
            : `~~<#${guildConfig.goodbyeChannelId}>~~ ❌ (Deleted)`,
          inline: true,
        });
      } else {
        fields.push({
          name: "👋 Goodbye Channel",
          value: "Not configured",
          inline: true,
        });
      }

      // Status fields
      fields.push(
        {
          name: "🎉 Welcome Messages",
          value: guildConfig.welcomeEnabled ? "✅ Enabled" : "❌ Disabled",
          inline: true,
        },
        {
          name: "😢 Goodbye Messages",
          value: guildConfig.goodbyeEnabled ? "✅ Enabled" : "❌ Disabled",
          inline: true,
        }
      );

      embed.addFields(fields);

      const enabledFeatures = [
        guildConfig.welcomeEnabled && "Welcome Messages",
        guildConfig.goodbyeEnabled && "Goodbye Messages",
      ].filter(Boolean).length;

      embed.setDescription(
        `**${enabledFeatures}/2** features enabled.\n\n` +
          (enabledFeatures === 0
            ? "Use `/welcome setup` to enable welcome/goodbye messages."
            : "Use `/welcome setup` to modify the configuration.")
      );

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error getting welcome status:", error);
      return {
        content: `❌ Failed to get welcome status: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleTest(): Promise<CommandResponse> {
    const messageType = this.getStringOption("type", true);

    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      if (!guildConfig) {
        return {
          content: "❌ Welcome system is not configured. Use `/welcome setup` first.",
          ephemeral: true,
        };
      }

      if (messageType === "welcome") {
        if (!guildConfig.welcomeEnabled || !guildConfig.welcomeChannelId) {
          return {
            content: "❌ Welcome messages are not enabled or no welcome channel is configured.",
            ephemeral: true,
          };
        }

        const channel = this.guild.channels.cache.get(guildConfig.welcomeChannelId);
        if (!channel?.isTextBased()) {
          return {
            content: "❌ Welcome channel not found or is not a text channel.",
            ephemeral: true,
          };
        }

        // Send test welcome message
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🎉 Welcome!")
          .setDescription(`Welcome to **${this.guild.name}**, ${this.user}!`)
          .setThumbnail(this.user.displayAvatarURL())
          .addFields(
            {
              name: "👤 Member Count",
              value: `You are member #${this.guild.memberCount}`,
              inline: true,
            },
            {
              name: "📅 Account Created",
              value: `<t:${Math.floor(this.user.createdTimestamp / 1000)}:R>`,
              inline: true,
            }
          )
          .setFooter({ text: "🧪 This is a test message" })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        return {
          content: `✅ Test welcome message sent to <#${guildConfig.welcomeChannelId}>`,
          ephemeral: true,
        };
      } else if (messageType === "goodbye") {
        if (!guildConfig.goodbyeEnabled || !guildConfig.goodbyeChannelId) {
          return {
            content: "❌ Goodbye messages are not enabled or no goodbye channel is configured.",
            ephemeral: true,
          };
        }

        const channel = this.guild.channels.cache.get(guildConfig.goodbyeChannelId);
        if (!channel?.isTextBased()) {
          return {
            content: "❌ Goodbye channel not found or is not a text channel.",
            ephemeral: true,
          };
        }

        // Send test goodbye message
        const embed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle("👋 Goodbye!")
          .setDescription(`**${this.user.username}** has left **${this.guild.name}**.`)
          .setThumbnail(this.user.displayAvatarURL())
          .addFields({
            name: "👤 Members Now",
            value: `${this.guild.memberCount - 1}`,
            inline: true,
          })
          .setFooter({ text: "🧪 This is a test message" })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        return {
          content: `✅ Test goodbye message sent to <#${guildConfig.goodbyeChannelId}>`,
          ephemeral: true,
        };
      }

      return {
        content: "❌ Invalid message type specified.",
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error sending test message:", error);
      return {
        content: `❌ Failed to send test message: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new WelcomeCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("ADMIN ONLY: Configure welcome system for new members")
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
  .addSubcommand((sub) => sub.setName("status").setDescription("View current welcome/goodbye configuration"));
