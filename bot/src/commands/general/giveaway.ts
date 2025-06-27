import type { Giveaway } from "@shared/database";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { ResponseBuilder, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

// Store active giveaways in memory for quick access
const activeGiveaways = new Map<string, Giveaway>();

/**
 * Giveaway Command - Create and manage giveaways
 */
export class GiveawayCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway",
      description: "Create and manage giveaways",
      category: "general",
      permissions: {
        level: PermissionLevel.MODERATOR,
        isConfigurable: true,
      },
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const interaction = this.interaction as ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "create":
          return await this.handleCreateGiveaway();
        case "end":
          return await this.handleEndGiveaway();
        case "reroll":
          return await this.handleRerollGiveaway();
        case "list":
          return await this.handleListGiveaways();
        default:
          return this.createGeneralError("Invalid Subcommand", "Unknown giveaway subcommand");
      }
    } catch (error) {
      return this.createGeneralError(
        "Giveaway Error",
        `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleCreateGiveaway(): Promise<CommandResponse> {
    const interaction = this.interaction as ChatInputCommandInteraction;
    const prize = interaction.options.getString("prize", true);
    const duration = interaction.options.getInteger("duration", true);
    const winners = interaction.options.getInteger("winners") ?? 1;
    const description = interaction.options.getString("description");
    const requiredRole = interaction.options.getRole("required_role");
    const blockedRole = interaction.options.getRole("blocked_role");
    const minimumLevel = interaction.options.getInteger("minimum_level");

    try {
      const endsAt = new Date(Date.now() + duration * 60 * 1000);
      const giveawayId = generateGiveawayId();

      // Create giveaway in database
      const giveaway: Giveaway = await prisma.giveaway.create({
        data: {
          guildId: this.guild.id,
          channelId: this.interaction.channel?.id ?? "",
          messageId: "temp", // Will update after message is sent
          giveawayId,
          hostId: this.user.id,
          title: `🎉 ${prize}`,
          description,
          prize,
          winnersCount: winners,
          requiredRoles: requiredRole ? [requiredRole.id] : [],
          blockedRoles: blockedRole ? [blockedRole.id] : [],
          minimumLevel,
          endsAt,
        },
      });

      // Create embed
      const embed = createGiveawayEmbed(giveaway, this.user.displayAvatarURL());

      // Create enter button
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${giveaway.id}`)
          .setLabel("🎉 Enter Giveaway")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`giveaway_entries_${giveaway.id}`)
          .setLabel("👥 View Entries")
          .setStyle(ButtonStyle.Secondary)
      );

      // Store in memory for quick access after message creation
      const response = { embeds: [embed], components: [row] };

      // Schedule database update and automatic ending in background
      void (async () => {
        try {
          // Update database with message ID after response is sent
          const messageId = await this.getMessageIdAfterReply();
          if (messageId) {
            await prisma.giveaway.update({
              where: { id: giveaway.id },
              data: { messageId },
            });

            activeGiveaways.set(giveaway.id, { ...giveaway, messageId });
          }

          // Schedule automatic ending
          setTimeout(
            () => {
              void (async () => {
                try {
                  await endGiveaway(this.client, giveaway.id);
                } catch (error) {
                  logger.warn(`Failed to end giveaway ${giveaway.id} automatically:`, error);
                }
              })();
            },
            duration * 60 * 1000
          );

          // Log giveaway creation
          await this.client.logManager.log(this.guild.id, "GIVEAWAY_CREATE", {
            userId: this.user.id,
            channelId: this.interaction.channel?.id,
            metadata: {
              giveawayId: giveaway.giveawayId,
              prize,
              duration,
              winners,
              endsAt: giveaway.endsAt.toISOString(),
            },
          });
        } catch (error) {
          logger.error("Error in giveaway post-creation tasks:", error);
        }
      })();

      return response;
    } catch (error) {
      return this.createGeneralError("Creation Failed", "Failed to create giveaway. Please try again.");
    }
  }

  private async handleEndGiveaway(): Promise<CommandResponse> {
    const interaction = this.interaction as ChatInputCommandInteraction;
    const giveawayId = interaction.options.getString("giveaway_id", true);

    try {
      await endGiveaway(this.client, giveawayId);
      return new ResponseBuilder()
        .success("Giveaway Ended")
        .content("✅ Giveaway has been ended successfully!")
        .ephemeral()
        .build();
    } catch (error) {
      return this.createGeneralError("End Failed", "Failed to end giveaway. Please check the ID and try again.");
    }
  }

  private async handleRerollGiveaway(): Promise<CommandResponse> {
    const interaction = this.interaction as ChatInputCommandInteraction;
    const giveawayId = interaction.options.getString("giveaway_id", true);
    const newWinners = interaction.options.getInteger("winners");

    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true },
      });

      if (!giveaway) {
        return this.createGeneralError("Giveaway Not Found", "Could not find the specified giveaway.");
      }

      if (!giveaway.hasEnded) {
        return this.createGeneralError("Giveaway Active", "Cannot reroll an active giveaway. End it first.");
      }

      const winnersCount = newWinners ?? giveaway.winnersCount;
      const eligibleEntries = giveaway.entries.map((entry) => entry.userId);

      if (eligibleEntries.length === 0) {
        return this.createGeneralError("No Entries", "No valid entries found for this giveaway.");
      }

      const winners = selectRandomWinners(eligibleEntries, winnersCount);

      // Update giveaway with new winners
      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { winners: winners },
      });

      // Create reroll announcement
      const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway Rerolled!")
        .setDescription(`**Prize:** ${giveaway.prize}`)
        .addFields({
          name: "🏆 New Winners",
          value: winners.length > 0 ? winners.map((id) => `<@${id}>`).join("\n") : "No winners selected",
          inline: false,
        })
        .setColor(0x00ff00)
        .setTimestamp();

      return { embeds: [embed] };
    } catch (error) {
      return this.createGeneralError("Reroll Failed", "Failed to reroll giveaway. Please try again.");
    }
  }

  private async handleListGiveaways(): Promise<CommandResponse> {
    try {
      const giveaways = await prisma.giveaway.findMany({
        where: {
          guildId: this.guild.id,
          hasEnded: false,
        },
        orderBy: { endsAt: "asc" },
        take: 10,
      });

      if (giveaways.length === 0) {
        return new ResponseBuilder()
          .info("No Active Giveaways")
          .content("There are no active giveaways in this server.")
          .ephemeral()
          .build();
      }

      const embed = new EmbedBuilder()
        .setTitle("🎉 Active Giveaways")
        .setColor(0x3498db)
        .setDescription(
          giveaways
            .map(
              (g) =>
                `**${g.prize}**\n` +
                `ID: \`${g.giveawayId}\`\n` +
                `Ends: <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>\n` +
                `Winners: ${g.winnersCount}\n`
            )
            .join("\n")
        )
        .setFooter({ text: `${giveaways.length} active giveaway${giveaways.length === 1 ? "" : "s"}` });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      return this.createGeneralError("List Failed", "Failed to list giveaways. Please try again.");
    }
  }

  private getMessageIdAfterReply(): Promise<string | null> {
    try {
      // This is a helper method to get the message ID after the reply is sent
      // In practice, this would need to be implemented based on how the framework handles replies
      return Promise.resolve(null); // Placeholder - would need actual implementation
    } catch {
      return Promise.resolve(null);
    }
  }
}

// Export the command instance
export default new GiveawayCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Create and manage giveaways")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Create a new giveaway")
      .addStringOption((opt) =>
        opt.setName("prize").setDescription("What is being given away").setRequired(true).setMaxLength(200)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration in minutes (minimum: 1, max: 10080 = 1 week)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10080)
      )
      .addIntegerOption((opt) =>
        opt.setName("winners").setDescription("Number of winners (default: 1)").setMinValue(1).setMaxValue(20)
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("Additional description or requirements").setMaxLength(500)
      )
      .addRoleOption((opt) => opt.setName("required_role").setDescription("Role required to enter"))
      .addRoleOption((opt) => opt.setName("blocked_role").setDescription("Role that cannot enter"))
      .addIntegerOption((opt) =>
        opt.setName("minimum_level").setDescription("Minimum user level to enter (if level system is active)")
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("end")
      .setDescription("End a giveaway early")
      .addStringOption((opt) =>
        opt.setName("giveaway_id").setDescription("Giveaway ID to end").setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reroll")
      .setDescription("Reroll winners for a giveaway")
      .addStringOption((opt) =>
        opt.setName("giveaway_id").setDescription("Giveaway ID to reroll").setRequired(true).setAutocomplete(true)
      )
      .addIntegerOption((opt) => opt.setName("winners").setDescription("Number of new winners to select"))
  )
  .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List active giveaways in this server"));

// Helper functions
function generateGiveawayId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function createGiveawayEmbed(giveaway: Giveaway, hostAvatarURL: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(giveaway.title)
    .setDescription(
      [
        `**Prize:** ${giveaway.prize}`,
        giveaway.description ? `**Description:** ${giveaway.description}` : null,
        `**Winners:** ${giveaway.winnersCount}`,
        `**Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
        `**Host:** <@${giveaway.hostId}>`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setColor(0x3498db)
    .setFooter({
      text: `Giveaway ID: ${giveaway.giveawayId} • React to enter!`,
      iconURL: hostAvatarURL,
    })
    .setTimestamp(giveaway.endsAt);

  // Add requirements if any
  const requirements: string[] = [];
  if (giveaway.requiredRoles.length > 0) {
    requirements.push(`Must have role: ${giveaway.requiredRoles.map((id) => `<@&${id}>`).join(" or ")}`);
  }
  if (giveaway.blockedRoles.length > 0) {
    requirements.push(`Cannot have role: ${giveaway.blockedRoles.map((id) => `<@&${id}>`).join(" or ")}`);
  }
  if (giveaway.minimumLevel) {
    requirements.push(`Minimum level: ${giveaway.minimumLevel}`);
  }

  if (requirements.length > 0) {
    embed.addFields({
      name: "📋 Requirements",
      value: requirements.join("\n"),
      inline: false,
    });
  }

  return embed;
}

async function endGiveaway(client: Client, giveawayDbId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
      include: { entries: true },
    });

    if (!giveaway || giveaway.hasEnded) {
      return;
    }

    const eligibleEntries = giveaway.entries.map((entry) => entry.userId);
    const winners = selectRandomWinners(eligibleEntries, giveaway.winnersCount);

    // Update giveaway as ended
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        hasEnded: true,
        endedAt: new Date(),
        winners: winners,
      },
    });

    // Remove from active giveaways
    activeGiveaways.delete(giveaway.id);

    // Get the channel and message
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(giveaway.channelId);
    if (!channel?.isTextBased()) return;

    try {
      const message = await channel.messages.fetch(giveaway.messageId);

      // Create ended embed
      const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway Ended!")
        .setDescription(
          [
            `**Prize:** ${giveaway.prize}`,
            giveaway.description ? `**Description:** ${giveaway.description}` : null,
            `**Winners:** ${giveaway.winnersCount}`,
            `**Host:** <@${giveaway.hostId}>`,
          ]
            .filter(Boolean)
            .join("\n")
        )
        .addFields({
          name: "🏆 Winners",
          value: winners.length > 0 ? winners.map((id) => `<@${id}>`).join("\n") : "No valid entries",
          inline: false,
        })
        .setColor(0x00ff00)
        .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId} • Ended` })
        .setTimestamp();

      // Update message
      await message.edit({
        embeds: [embed],
        components: [], // Remove buttons
      });

      // Announce winners if any
      if (winners.length > 0) {
        await channel.send({
          content: `🎉 **Congratulations!** ${winners.map((id) => `<@${id}>`).join(", ")} won **${giveaway.prize}**!`,
        });
      }
    } catch (error) {
      logger.warn(`Could not update giveaway message ${giveaway.messageId}:`, error);
    }

    // Log giveaway end
    await client.logManager.log(giveaway.guildId, "GIVEAWAY_END", {
      userId: "system",
      channelId: giveaway.channelId,
      metadata: {
        giveawayId: giveaway.giveawayId,
        prize: giveaway.prize,
        winners,
        totalEntries: eligibleEntries.length,
      },
    });
  } catch (error) {
    logger.error(`Error ending giveaway ${giveawayDbId}:`, error);
  }
}

function selectRandomWinners(userIds: string[], count: number): string[] {
  if (userIds.length === 0) return [];
  if (count >= userIds.length) return [...userIds];

  const shuffled = [...userIds].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function handleGiveawayInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith("giveaway_enter_")) {
    const giveawayDbId = customId.replace("giveaway_enter_", "");
    await handleGiveawayEntry(interaction, giveawayDbId);
  } else if (customId.startsWith("giveaway_entries_")) {
    const giveawayDbId = customId.replace("giveaway_entries_", "");
    await handleViewEntries(interaction, giveawayDbId);
  }
}

async function handleGiveawayEntry(interaction: ButtonInteraction, giveawayDbId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
      include: { entries: true },
    });

    if (!giveaway) {
      await interaction.reply({
        content: "❌ This giveaway no longer exists.",
        ephemeral: true,
      });
      return;
    }

    if (giveaway.hasEnded) {
      await interaction.reply({
        content: "❌ This giveaway has already ended.",
        ephemeral: true,
      });
      return;
    }

    if (new Date() > giveaway.endsAt) {
      await interaction.reply({
        content: "❌ This giveaway has expired.",
        ephemeral: true,
      });
      return;
    }

    // Check if user already entered
    const existingEntry = giveaway.entries.find((entry) => entry.userId === interaction.user.id);
    if (existingEntry) {
      await interaction.reply({
        content: "❌ You have already entered this giveaway!",
        ephemeral: true,
      });
      return;
    }

    // Check requirements
    const member = interaction.member as GuildMember;

    // Check required roles
    if (giveaway.requiredRoles.length > 0) {
      const hasRequiredRole = giveaway.requiredRoles.some((roleId) => member.roles.cache.has(roleId));
      if (!hasRequiredRole) {
        await interaction.reply({
          content: "❌ You don't have the required role to enter this giveaway.",
          ephemeral: true,
        });
        return;
      }
    }

    // Check blocked roles
    if (giveaway.blockedRoles.length > 0) {
      const hasBlockedRole = giveaway.blockedRoles.some((roleId) => member.roles.cache.has(roleId));
      if (hasBlockedRole) {
        await interaction.reply({
          content: "❌ You cannot enter this giveaway due to your current roles.",
          ephemeral: true,
        });
        return;
      }
    }

    // Add entry
    await prisma.giveawayEntry.create({
      data: {
        giveawayId: giveaway.id,
        userId: interaction.user.id,
        guildId: interaction.guildId ?? "",
      },
    });

    await interaction.reply({
      content: "✅ You have successfully entered the giveaway! Good luck! 🍀",
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error handling giveaway entry:", error);
    await interaction.reply({
      content: "❌ An error occurred while entering the giveaway.",
      ephemeral: true,
    });
  }
}

async function handleViewEntries(interaction: ButtonInteraction, giveawayDbId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
      include: { entries: true },
    });

    if (!giveaway) {
      await interaction.reply({
        content: "❌ This giveaway no longer exists.",
        ephemeral: true,
      });
      return;
    }

    const entryCount = giveaway.entries.length;
    const embed = new EmbedBuilder()
      .setTitle("👥 Giveaway Entries")
      .setDescription(`**Prize:** ${giveaway.prize}`)
      .addFields({
        name: "📊 Statistics",
        value: [
          `**Total Entries:** ${entryCount}`,
          `**Winners to Select:** ${giveaway.winnersCount}`,
          `**Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
        ].join("\n"),
        inline: false,
      })
      .setColor(0x3498db)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error viewing giveaway entries:", error);
    await interaction.reply({
      content: "❌ An error occurred while viewing entries.",
      ephemeral: true,
    });
  }
}
