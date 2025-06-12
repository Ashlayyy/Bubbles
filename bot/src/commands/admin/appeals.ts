import { ChannelType, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("appeals")
    .setDescription("ADMIN ONLY: Manage user appeals for punishments")
    .setDefaultMemberPermissions(0)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up appeals system")
        .addStringOption((opt) =>
          opt
            .setName("website")
            .setDescription("Your appeals website URL (e.g., https://appeals.yourdomain.com)")
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel where staff review appeals")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("cooldown")
            .setDescription("Hours between appeals (default: 24)")
            .setMinValue(1)
            .setMaxValue(168)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max_appeals")
            .setDescription("Maximum appeals per user (default: 3)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("View current appeals configuration"))
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable the appeals system"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable the appeals system"))
    .addSubcommand((sub) =>
      sub
        .setName("messages")
        .setDescription("Configure appeal response messages")
        .addStringOption((opt) =>
          opt.setName("received").setDescription("Message sent when appeal is received").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("approved").setDescription("Message sent when appeal is approved").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("denied").setDescription("Message sent when appeal is denied").setRequired(false)
        )
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "setup": {
          const website = interaction.options.getString("website");
          const channel = interaction.options.getChannel("channel");
          const cooldown = interaction.options.getInteger("cooldown");
          const maxAppeals = interaction.options.getInteger("max_appeals");

          await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
            webFormUrl: website ?? undefined,
            appealChannelId: channel?.id,
            cooldownHours: cooldown ?? undefined,
            maxAppealsPerUser: maxAppeals ?? undefined,
          });

          const embed = client.genEmbed({
            title: "✅ Appeals System Configured",
            color: 0x2ecc71,
            fields: [
              {
                name: "Website URL",
                value: website ?? "Using default from bot config",
                inline: false,
              },
              {
                name: "Review Channel",
                value: channel ? `<#${channel.id}>` : "Not set",
                inline: true,
              },
              {
                name: "Cooldown",
                value: `${(cooldown ?? 24).toString()} hours`,
                inline: true,
              },
              {
                name: "Max Appeals",
                value: `${(maxAppeals ?? 3).toString()} per user`,
                inline: true,
              },
            ],
          });

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case "status": {
          const settings = await client.moderationManager.getAppealsSettings(interaction.guild.id);

          const embed = client.genEmbed({
            title: "📋 Appeals System Status",
            color: settings.discordBotEnabled ? 0x2ecc71 : 0xe74c3c,
            fields: [
              {
                name: "🔘 Status",
                value: settings.discordBotEnabled ? "✅ Enabled" : "❌ Disabled",
                inline: true,
              },
              {
                name: "🌐 Website",
                value: settings.webFormUrl ?? "Default URL",
                inline: false,
              },
              {
                name: "📝 Review Channel",
                value:
                  "appealChannelId" in settings && settings.appealChannelId
                    ? `<#${settings.appealChannelId}>`
                    : "Not configured",
                inline: true,
              },
              {
                name: "⏰ Cooldown",
                value: `${Math.floor(settings.appealCooldown / 3600).toString()} hours`,
                inline: true,
              },
              {
                name: "🔢 Max Appeals",
                value: `${settings.maxAppealsPerUser.toString()} per user`,
                inline: true,
              },
            ],
          });

          // Add message previews
          if (
            "appealReceived" in settings &&
            (settings.appealReceived ?? settings.appealApproved ?? settings.appealDenied)
          ) {
            const messages = [];
            if (settings.appealReceived) messages.push(`**Received:** ${settings.appealReceived}`);
            if (settings.appealApproved) messages.push(`**Approved:** ${settings.appealApproved}`);
            if (settings.appealDenied) messages.push(`**Denied:** ${settings.appealDenied}`);

            embed.addFields({
              name: "💬 Custom Messages",
              value: messages.join("\n\n") || "Using defaults",
              inline: false,
            });
          }

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case "enable": {
          await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
            enabled: true,
          });

          await interaction.reply({
            content: "✅ Appeals system has been **enabled**.",
            ephemeral: true,
          });
          break;
        }

        case "disable": {
          await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
            enabled: false,
          });

          await interaction.reply({
            content: "❌ Appeals system has been **disabled**.",
            ephemeral: true,
          });
          break;
        }

        case "messages": {
          const received = interaction.options.getString("received");
          const approved = interaction.options.getString("approved");
          const denied = interaction.options.getString("denied");

          await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
            appealReceived: received ?? undefined,
            appealApproved: approved ?? undefined,
            appealDenied: denied ?? undefined,
          });

          const embed = client.genEmbed({
            title: "✅ Appeal Messages Updated",
            color: 0x2ecc71,
            fields: [],
          });

          if (received) embed.addFields({ name: "📥 Received Message", value: received, inline: false });
          if (approved) embed.addFields({ name: "✅ Approved Message", value: approved, inline: false });
          if (denied) embed.addFields({ name: "❌ Denied Message", value: denied, inline: false });

          if (!received && !approved && !denied) {
            embed.setDescription("No messages were updated. Use the options to set custom messages.");
          }

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }
      }
    } catch (error: unknown) {
      await interaction.reply({
        content: `❌ Error configuring appeals: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
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
