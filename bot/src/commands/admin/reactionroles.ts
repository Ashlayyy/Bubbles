import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  Guild,
  Message,
  ModalBuilder,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import type { ReactionRole } from "@shared/database";
import camelCaseFn from "lodash/camelCase.js";
import kebabCaseFn from "lodash/kebabCase.js";
import {
  addReactionRole,
  createReactionRoleMessage,
  deleteReactionRoleMessage,
  getReactionRoleMessagesByGuild,
  getReactionRolesByMessage,
  removeReactionRole,
} from "../../database/ReactionRoles.js";
import { parseEmoji } from "../../functions/general/emojis.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import Command, { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Helper functions
const kebabCase = kebabCaseFn;
const camelCase = camelCaseFn;

// Main command builder
const commandBuilder = (() => {
  const builder = new SlashCommandBuilder()
    .setName("reaction-roles")
    .setDescription("Manage reaction roles for your server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)

    // Message Management Group
    .addSubcommandGroup((group) =>
      group
        .setName("message")
        .setDescription("Create and manage reaction role messages")
        .addSubcommand((sub) =>
          sub.setName("create").setDescription("Create a new reaction role message with interactive builder")
        )
        .addSubcommand((sub) => sub.setName("list").setDescription("List all reaction role messages in this server"))
        .addSubcommand((sub) =>
          sub
            .setName("delete")
            .setDescription("Delete a reaction role message")
            .addStringOption((opt) =>
              opt.setName("message-id").setDescription("ID of the message to delete").setRequired(true)
            )
        )
    )

    // Role Mapping Group
    .addSubcommandGroup((group) =>
      group
        .setName("mapping")
        .setDescription("Add, remove, and manage individual role mappings")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a reaction role to an existing message")
            .addStringOption((opt) => opt.setName("message-id").setDescription("ID of the message").setRequired(true))
            .addStringOption((opt) => opt.setName("emoji").setDescription("Emoji for the reaction").setRequired(true))
            .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign").setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a reaction role from a message")
            .addStringOption((opt) => opt.setName("message-id").setDescription("ID of the message").setRequired(true))
            .addStringOption((opt) => opt.setName("emoji").setDescription("Emoji to remove").setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName("list")
            .setDescription("List all reaction roles for a specific message")
            .addStringOption((opt) => opt.setName("message-id").setDescription("ID of the message").setRequired(true))
        )
    );

  return builder;
})();

// Functions for subcommands
async function findMessageById(guild: Guild, messageId: string): Promise<Message | null> {
  const channels = guild.channels.cache.filter((c) => c instanceof TextChannel) as Map<string, TextChannel>;
  for (const channel of channels.values()) {
    try {
      return await channel.messages.fetch(messageId);
    } catch (_error) {
      // Ignore errors (message not in this channel)
    }
  }
  return null;
}

// Message Group Handlers
async function handleMessageCreate(client: Client, interaction: GuildChatInputCommandInteraction) {
  const state = {
    embed: new EmbedBuilder()
      .setTitle("New Reaction Role Message")
      .setDescription("Use the buttons below to build your message.")
      .setColor(0x3498db),
    roles: new Map<string, string>(), // emoji -> roleId
  };

  const generateComponents = () => {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rr_title").setLabel("Set Title").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rr_desc").setLabel("Set Description").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rr_color").setLabel("Set Color").setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rr_add_role").setLabel("Add Role").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("rr_preview").setLabel("Preview").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("rr_post").setLabel("Post Message").setStyle(ButtonStyle.Success)
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rr_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger)
    );
    return [row1, row2, row3];
  };

  const updateMessage = async () => {
    const rolesText =
      state.roles.size > 0
        ? [...state.roles.entries()].map(([e, r]) => `${e} → <@&${r}>`).join("\n")
        : "No roles added yet";

    state.embed.setFields({
      name: `🎭 Roles (${state.roles.size})`,
      value: rolesText,
    });

    await interaction.editReply({
      embeds: [state.embed],
      components: generateComponents(),
    });
  };

  await interaction.reply({
    content:
      "🎨 **Reaction Role Message Builder**\nCreate a beautiful reaction role message with custom embed styling.",
    embeds: [state.embed],
    components: generateComponents(),
    ephemeral: true,
  });

  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 600000, // 10 minutes
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "❌ You can't use these buttons.", ephemeral: true });
      return;
    }

    try {
      switch (i.customId) {
        case "rr_title": {
          const modal = new ModalBuilder().setCustomId("rr_title_modal").setTitle("Set Message Title");
          const input = new TextInputBuilder()
            .setCustomId("title")
            .setLabel("Title")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
          if (submitted) {
            await submitted.deferUpdate();
            state.embed.setTitle(submitted.fields.getTextInputValue("title"));
            await updateMessage();
          }
          break;
        }

        case "rr_desc": {
          const modal = new ModalBuilder().setCustomId("rr_desc_modal").setTitle("Set Message Description");
          const input = new TextInputBuilder()
            .setCustomId("description")
            .setLabel("Description")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2048)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
          if (submitted) {
            await submitted.deferUpdate();
            state.embed.setDescription(submitted.fields.getTextInputValue("description"));
            await updateMessage();
          }
          break;
        }

        case "rr_color": {
          const colorOptions = [
            { label: "Blue", value: "0x3498db", emoji: "🔵" },
            { label: "Green", value: "0x2ecc71", emoji: "🟢" },
            { label: "Red", value: "0xe74c3c", emoji: "🔴" },
            { label: "Purple", value: "0x9b59b6", emoji: "🟣" },
            { label: "Orange", value: "0xe67e22", emoji: "🟠" },
            { label: "Yellow", value: "0xf1c40f", emoji: "🟡" },
            { label: "Pink", value: "0xe91e63", emoji: "🩷" },
            { label: "Custom", value: "custom", emoji: "🎨" },
          ];

          const select = new StringSelectMenuBuilder()
            .setCustomId("color_select")
            .setPlaceholder("Choose a color...")
            .addOptions(colorOptions);

          await i.update({
            content: "🎨 Choose a color for your embed:",
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
          });

          const colorInteraction = await reply
            .awaitMessageComponent({
              componentType: ComponentType.StringSelect,
              time: 30000,
            })
            .catch(() => null);

          if (colorInteraction?.isStringSelectMenu()) {
            if (colorInteraction.values[0] === "custom") {
              const modal = new ModalBuilder().setCustomId("custom_color_modal").setTitle("Custom Color");
              const input = new TextInputBuilder()
                .setCustomId("hex_color")
                .setLabel("Hex Color Code (e.g., #FF0000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
              modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

              await colorInteraction.showModal(modal);
              const colorSubmitted = await colorInteraction.awaitModalSubmit({ time: 60000 }).catch(() => null);
              if (colorSubmitted) {
                await colorSubmitted.deferUpdate();
                const color = colorSubmitted.fields.getTextInputValue("hex_color");
                if (/^#?[0-9A-F]{6}$/i.test(color)) {
                  state.embed.setColor(color.startsWith("#") ? (color as `#${string}`) : (`#${color}` as `#${string}`));
                }
              }
            } else {
              await colorInteraction.deferUpdate();
              state.embed.setColor(parseInt(colorInteraction.values[0]));
            }
            await updateMessage();
          }
          break;
        }

        case "rr_add_role": {
          await i.update({
            content: "📝 Type the emoji you want to use for this role:",
            embeds: [],
            components: [],
          });

          const emojiFilter = (m: Message) => m.author.id === interaction.user.id;
          const collected = await interaction.channel
            ?.awaitMessages({
              filter: emojiFilter,
              max: 1,
              time: 30000,
              errors: ["time"],
            })
            .catch(() => null);

          const emojiMessage = collected?.first();
          if (emojiMessage) {
            await emojiMessage.delete().catch(() => {});
          }

          const emojiRaw = emojiMessage?.content;
          if (!emojiRaw) {
            await i.followUp({ content: "⏰ You didn't provide an emoji in time.", ephemeral: true });
            await updateMessage();
            return;
          }

          const emoji = parseEmoji(emojiRaw, client);
          if (!emoji) {
            await i.followUp({ content: "❌ That doesn't appear to be a valid emoji.", ephemeral: true });
            await updateMessage();
            return;
          }

          const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("role_select")
            .setPlaceholder("Select a role...")
            .setMaxValues(1);

          await i.editReply({
            content: `✅ Emoji set to ${emoji.name}. Now select the role:`,
            components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)],
          });

          const roleInteraction = await reply
            .awaitMessageComponent({
              componentType: ComponentType.RoleSelect,
              time: 30000,
            })
            .catch(() => null);

          if (roleInteraction?.isRoleSelectMenu()) {
            const roleId = roleInteraction.values[0];
            const role = roleInteraction.guild?.roles.cache.get(roleId);
            state.roles.set(emoji.name, roleId);

            await roleInteraction.update({
              content: `✅ Added: ${emoji.name} → **${role?.name}**`,
            });
          } else {
            await i.followUp({ content: "⏰ You didn't select a role in time.", ephemeral: true });
          }

          await updateMessage();
          break;
        }

        case "rr_preview": {
          await i.deferUpdate();
          const previewEmbed = EmbedBuilder.from(state.embed);
          await i.followUp({
            content: "👀 **Preview of your reaction role message:**",
            embeds: [previewEmbed],
            ephemeral: true,
          });
          break;
        }

        case "rr_post": {
          if (state.roles.size === 0) {
            await i.reply({ content: "❌ You need to add at least one role before posting.", ephemeral: true });
            return;
          }

          const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId("channel_select")
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder("Select a channel to post the message");

          await i.update({
            content: "📍 Select a channel to post your reaction role message:",
            embeds: [],
            components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)],
          });

          const channelInteraction = await reply
            .awaitMessageComponent({
              componentType: ComponentType.ChannelSelect,
              time: 60000,
            })
            .catch(() => null);

          if (channelInteraction?.isChannelSelectMenu()) {
            const channel = channelInteraction.channels.first();
            if (channel instanceof TextChannel) {
              await channelInteraction.deferUpdate();

              try {
                const finalMessage = await channel.send({ embeds: [state.embed] });

                // Add reactions and database entries
                for (const [emoji, roleId] of state.roles.entries()) {
                  await finalMessage.react(emoji);
                  await addReactionRole(interaction, finalMessage.id, emoji, roleId);
                }

                // Create reaction role message entry
                await createReactionRoleMessage({
                  guildId: interaction.guild!.id,
                  channelId: channel.id,
                  messageId: finalMessage.id,
                  title: state.embed.data.title || "Reaction Roles",
                  description: state.embed.data.description,
                  embedColor: state.embed.data.color?.toString(),
                  createdBy: interaction.user.id,
                });

                await channelInteraction.editReply({
                  content: `✅ **Success!** Reaction role message posted in ${channel}!\n🔗 [Jump to message](${finalMessage.url})`,
                  components: [],
                });

                // Log the creation
                await client.logManager.log(interaction.guild!.id, "REACTION_ROLE_MESSAGE_CREATE", {
                  userId: interaction.user.id,
                  channelId: channel.id,
                  metadata: {
                    messageId: finalMessage.id,
                    roleCount: state.roles.size,
                    roles: Array.from(state.roles.entries()),
                  },
                });
              } catch (error) {
                logger.error("Error posting reaction role message:", error);
                await channelInteraction.editReply({
                  content: "❌ Failed to post the message. Please check my permissions in that channel.",
                  components: [],
                });
              }
            }
          } else {
            await i.followUp({ content: "⏰ You didn't select a channel in time.", ephemeral: true });
          }
          collector.stop();
          break;
        }

        case "rr_cancel": {
          await i.update({
            content: "❌ Reaction role builder cancelled.",
            embeds: [],
            components: [],
          });
          collector.stop();
          break;
        }
      }
    } catch (error) {
      logger.error("Error in reaction role builder:", error);
      await i.followUp({ content: "❌ An error occurred. Please try again.", ephemeral: true });
    }
  });

  collector.on("end", (_collected, reason) => {
    if (reason === "time") {
      void interaction.editReply({
        content: "⏰ Builder timed out after 10 minutes.",
        components: [],
      });
    }
  });
}

async function handleMessageList(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const messages = await getReactionRoleMessagesByGuild(interaction.guild!.id);

  if (messages.length === 0) {
    await interaction.followUp({
      content: "📭 No reaction role messages found in this server.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🎭 Reaction Role Messages")
    .setDescription(`Found **${messages.length}** reaction role message${messages.length === 1 ? "" : "s"}`)
    .setColor(0x3498db)
    .setTimestamp();

  const messageList = messages
    .slice(0, 10)
    .map((msg, index) => {
      const channel = client.channels.cache.get(msg.channelId);
      const channelMention = channel ? `<#${msg.channelId}>` : "Unknown Channel";
      return `**${index + 1}.** [${msg.title}](https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.messageId})\n└ ${channelMention} • <t:${Math.floor(new Date(msg.createdAt).getTime() / 1000)}:R>`;
    })
    .join("\n\n");

  embed.setDescription(messageList);

  if (messages.length > 10) {
    embed.setFooter({ text: `Showing first 10 of ${messages.length} messages` });
  }

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

async function handleMessageDelete(client: Client, interaction: GuildChatInputCommandInteraction) {
  const messageId = interaction.options.getString("message-id", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const message = await findMessageById(interaction.guild!, messageId);
    if (!message) {
      await interaction.followUp({
        content: "❌ Could not find a message with that ID in this server.",
        ephemeral: true,
      });
      return;
    }

    // Delete from database
    await deleteReactionRoleMessage(messageId);

    // Try to delete the actual Discord message
    try {
      await message.delete();
    } catch (error) {
      logger.warn("Could not delete Discord message:", error);
    }

    await interaction.followUp({
      content: "✅ Reaction role message deleted successfully!",
      ephemeral: true,
    });

    // Log the deletion
    await client.logManager.log(interaction.guild!.id, "REACTION_ROLE_MESSAGE_DELETE", {
      userId: interaction.user.id,
      channelId: message.channelId,
      metadata: {
        messageId: messageId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error deleting reaction role message:", error);
    await interaction.followUp({
      content: "❌ Failed to delete the reaction role message.",
      ephemeral: true,
    });
  }
}

// Mapping Group Handlers
async function handleMappingAdd(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.options.getString("message-id", true);
  const emojiRaw = interaction.options.getString("emoji", true);
  const role = interaction.options.getRole("role", true);

  const message = await findMessageById(interaction.guild!, messageId);
  if (!message) {
    await interaction.followUp({
      content: "❌ Could not find a message with that ID.",
      ephemeral: true,
    });
    return;
  }

  const emoji = parseEmoji(emojiRaw, client);
  if (!emoji) {
    await interaction.followUp({
      content: "❌ That doesn't seem to be a valid emoji I can use.",
      ephemeral: true,
    });
    return;
  }

  try {
    const dbResult = await addReactionRole(interaction, messageId, emojiRaw, role.id);
    if (!dbResult) {
      await interaction.followUp({
        content: "❌ Failed to add reaction role. This emoji may already be in use for this message.",
        ephemeral: true,
      });
      return;
    }

    await message.react(emoji.name);

    await interaction.followUp({
      content: `✅ **Success!** Added reaction role: ${emoji.name} → **${role.name}**`,
      ephemeral: true,
    });

    // Log the addition
    await client.logManager.log(interaction.guild!.id, "REACTION_ROLE_CONFIG_ADD", {
      userId: interaction.user.id,
      channelId: message.channelId,
      roleId: role.id,
      metadata: {
        emoji: emojiRaw,
        roleName: role.name,
        messageId: messageId,
      },
    });
  } catch (error) {
    logger.error("Error adding reaction role:", error);
    await interaction.followUp({
      content: "❌ Failed to add reaction role. Please check my permissions.",
      ephemeral: true,
    });
  }
}

async function handleMappingRemove(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.options.getString("message-id", true);
  const emojiRaw = interaction.options.getString("emoji", true);

  const message = await findMessageById(interaction.guild!, messageId);
  if (!message) {
    await interaction.followUp({
      content: "❌ Could not find a message with that ID.",
      ephemeral: true,
    });
    return;
  }

  const emoji = parseEmoji(emojiRaw, client);
  if (!emoji) {
    await interaction.followUp({
      content: "❌ That doesn't seem to be a valid emoji.",
      ephemeral: true,
    });
    return;
  }

  try {
    await removeReactionRole(client, messageId, emojiRaw);

    // Remove the reaction from the message
    await message.reactions.resolve(emoji.identifier)?.remove();

    await interaction.followUp({
      content: `✅ **Success!** Removed reaction role for ${emoji.name}`,
      ephemeral: true,
    });

    // Log the removal
    await client.logManager.log(interaction.guild!.id, "REACTION_ROLE_CONFIG_REMOVE", {
      userId: interaction.user.id,
      channelId: message.channelId,
      metadata: {
        emoji: emojiRaw,
        messageId: messageId,
      },
    });
  } catch (error) {
    logger.error("Error removing reaction role:", error);
    await interaction.followUp({
      content: "❌ Failed to remove reaction role.",
      ephemeral: true,
    });
  }
}

async function handleMappingList(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.options.getString("message-id", true);
  const roles = await getReactionRolesByMessage(messageId);

  if (roles.length === 0) {
    await interaction.followUp({
      content: "📭 No reaction roles are configured for that message.",
      ephemeral: true,
    });
    return;
  }

  const roleMappings = roles
    .map((r: ReactionRole) => {
      const emoji = client.emojis.cache.get(r.emoji) ?? r.emoji;
      const roleList = r.roleIds.map((roleId) => `<@&${roleId}>`).join(", ");
      return `${emoji.toString()} → ${roleList}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🎭 Reaction Role Mappings")
    .setDescription(roleMappings)
    .setColor(0x3498db)
    .setFooter({ text: `Message ID: ${messageId}` })
    .setTimestamp();

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

// Main command logic
export default new Command(
  commandBuilder,
  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommandGroup) {
        case "message":
          switch (subcommand) {
            case "create":
              await handleMessageCreate(client, interaction);
              break;
            case "list":
              await handleMessageList(client, interaction);
              break;
            case "delete":
              await handleMessageDelete(client, interaction);
              break;
          }
          break;

        case "mapping":
          switch (subcommand) {
            case "add":
              await handleMappingAdd(client, interaction);
              break;
            case "remove":
              await handleMappingRemove(client, interaction);
              break;
            case "list":
              await handleMappingList(client, interaction);
              break;
          }
          break;
      }
    } catch (error) {
      logger.error("Error in reaction-roles command:", error);
      const errorMessage = "❌ An unexpected error occurred. Please try again.";

      if (interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
