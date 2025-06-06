import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  PermissionsBitField,
  Role,
  SlashCommandBuilder,
} from "discord.js";

import { deleteReactionRoleMessage, getReactionRoleMessagesByGuild } from "../../database/ReactionRoles.js";
import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Enhanced builder data structure
interface BuilderData {
  guildId: string;
  channelId: string;
  userId: string;
  title: string;
  description?: string;
  embedColor: string;
  reactions: ReactionData[];
  createdAt: number;
  lastActivity: number;
  templateUsed?: string;
  validationWarnings: string[];
  currentStep: string;
}

interface ReactionData {
  emoji: string;
  roleIds: string[];
  roleValidations: RoleValidation[];
}

interface RoleValidation {
  roleId: string;
  roleName: string;
  warnings: string[];
  errors: string[];
  canAssign: boolean;
}

// Store temporary reaction role data with enhanced session management
export const reactionRoleBuilder = new Map<string, BuilderData>();
export type { BuilderData, ReactionData, RoleValidation };
const BUILDER_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Gaming and notification focused templates
const commonTemplates = [
  {
    id: "gaming-roles",
    name: "🎮 Gaming Notifications",
    title: "Game Notifications",
    description: "React to get pinged when we're playing your favorite games!",
    color: "#7289DA",
    suggestedReactions: [
      { emoji: "🎮", label: "General Gaming" },
      { emoji: "⚔️", label: "RPG Games" },
      { emoji: "🏆", label: "Competitive Games" },
      { emoji: "🎯", label: "FPS Games" },
      { emoji: "🏗️", label: "Building/Strategy" },
    ],
  },
  {
    id: "server-notifications",
    name: "📢 Server Notifications",
    title: "Notification Preferences",
    description: "Choose what server notifications you want to receive",
    color: "#43B581",
    suggestedReactions: [
      { emoji: "📢", label: "Announcements" },
      { emoji: "🎉", label: "Events" },
      { emoji: "📰", label: "News & Updates" },
      { emoji: "🔔", label: "General Pings" },
      { emoji: "🎪", label: "Fun Activities" },
    ],
  },
  {
    id: "custom",
    name: "🛠️ Custom Setup",
    title: "Custom Message",
    description: "Build your reaction roles from scratch",
  },
];

// Smart permission validation
const _validateRole = (role: Role, botMember: GuildMember, userMember: GuildMember): RoleValidation => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check dangerous permissions
  const dangerousPerms = [
    "Administrator",
    "ManageGuild",
    "ManageRoles",
    "ManageChannels",
    "ManageMessages",
    "BanMembers",
    "KickMembers",
    "ManageNicknames",
  ];

  const rolePerms = role.permissions.toArray();
  const foundDangerous = rolePerms.filter((perm) => dangerousPerms.includes(perm));

  if (foundDangerous.length > 0) {
    warnings.push(`⚠️ Role has sensitive permissions: ${foundDangerous.join(", ")}`);
  }

  // Check if bot can assign the role
  if (role.position >= botMember.roles.highest.position) {
    errors.push(`❌ Bot cannot assign this role (role hierarchy)`);
  }

  if (!botMember.permissions.has("ManageRoles")) {
    errors.push(`❌ Bot lacks 'Manage Roles' permission`);
  }

  // Check if user can assign the role
  if (!userMember.permissions.has("ManageRoles") && role.position >= userMember.roles.highest.position) {
    warnings.push(`⚠️ You might not be able to assign this role to others`);
  }

  return {
    roleId: role.id,
    roleName: role.name,
    warnings,
    errors,
    canAssign: errors.length === 0,
  };
};

// Session management functions
const createBuilderSession = (builderId: string, data: Partial<BuilderData>) => {
  const fullData: BuilderData = {
    createdAt: Date.now(),
    lastActivity: Date.now(),
    reactions: [],
    validationWarnings: [],
    currentStep: "template-selection",
    embedColor: "#5865F2",
    title: "",
    ...data,
  } as BuilderData;

  reactionRoleBuilder.set(builderId, fullData);

  // Auto-cleanup after 10 minutes
  setTimeout(() => {
    if (reactionRoleBuilder.has(builderId)) {
      reactionRoleBuilder.delete(builderId);
    }
  }, BUILDER_SESSION_TIMEOUT);

  return fullData;
};

const _updateSessionActivity = (builderId: string) => {
  const session = reactionRoleBuilder.get(builderId);
  if (session) {
    session.lastActivity = Date.now();
  }
};

export default new Command(
  new SlashCommandBuilder()
    .setName("reaction-roles")
    .setDescription("ADMIN ONLY: Manage reaction roles for your server")
    .addSubcommand((subcommand) => subcommand.setName("create").setDescription("Create a new reaction role message"))
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all reaction role messages in this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a reaction role message")
        .addStringOption((option) =>
          option.setName("message-id").setDescription("The ID of the message to delete").setRequired(true)
        )
    ),

  async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "create": {
        // Create unique builder ID and session
        const builderId = `${interaction.user.id}-${Date.now()}`;

        createBuilderSession(builderId, {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.user.id,
        });

        // Show template selection instead of modal
        const templateEmbed = client.genEmbed({
          title: "🚀 Choose Your Starting Point",
          description: "Select a template to get started quickly, or build from scratch",
          fields: commonTemplates.map((template) => ({
            name: template.name,
            value: template.description || "Custom configuration",
            inline: false,
          })),
          footer: { text: "Session expires in 10 minutes" },
        });

        const templateButtons = new ActionRowBuilder<ButtonBuilder>();

        // Add template buttons (max 5 per row)
        const buttons = commonTemplates.map((template) => {
          const emojiRegex = /🎮|📢|🛠️/;
          const emojiMatch = emojiRegex.exec(template.name);
          const emoji = emojiMatch?.[0] ?? "🔧";

          return new ButtonBuilder()
            .setCustomId(`template-${template.id}-${builderId}`)
            .setLabel(template.name.replace(/🎮|📢|🛠️/g, "").trim())
            .setStyle(template.id === "custom" ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setEmoji(emoji);
        });

        templateButtons.addComponents(buttons);

        await interaction.followUp({
          embeds: [templateEmbed],
          components: [templateButtons],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "list": {
        const messages = await getReactionRoleMessagesByGuild(interaction.guildId);

        if (messages.length === 0) {
          await interaction.followUp({
            content: "No reaction role messages found in this server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Reaction Role Messages")
          .setColor("#5865F2")
          .setDescription(
            messages
              .map((msg, index) => {
                const messageData = msg as { channelId: string; title: string; messageId: string };
                const channelMention = `<#${messageData.channelId}>`;
                return `**${(index + 1).toString()}.** ${messageData.title}\n📍 ${channelMention} | 🆔 \`${messageData.messageId}\``;
              })
              .join("\n\n")
          )
          .setFooter({ text: `${messages.length.toString()} message(s) total` });

        await interaction.followUp({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "delete": {
        const messageId = interaction.options.getString("message-id", true);

        try {
          await deleteReactionRoleMessage(messageId);

          await interaction.followUp({
            content: `✅ Successfully deleted reaction role message with ID: \`${messageId}\``,
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          logger.error("Failed to delete reaction role message:", error);
          await interaction.followUp({
            content: "❌ Failed to delete the reaction role message. Make sure the message ID is correct.",
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      }
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.ManageRoles],
      isConfigurable: true,
    },
  }
);
