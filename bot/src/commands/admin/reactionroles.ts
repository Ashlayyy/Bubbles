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
import { prisma } from "../../database/index.js";
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
import { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

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

// Defensive reply utility
async function safeReply(interaction: GuildChatInputCommandInteraction, options: any) {
  if (interaction.replied || interaction.deferred) {
    try {
      await interaction.editReply(options);
    } catch {
      await interaction.followUp({ ...options, ephemeral: true });
    }
  } else {
    await interaction.reply(options);
  }
}

// Message Group Handlers
async function handleMessageCreate(client: Client, interaction: GuildChatInputCommandInteraction) {
  const state = {
    embed: new EmbedBuilder()
      .setTitle("New Reaction Role Message")
      .setDescription(null) // Always empty as requested
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
    try {
      const rolesText =
        state.roles.size > 0
          ? [...state.roles.entries()].map(([e, r]) => `${e} → <@&${r}>`).join("\n")
          : "No roles added yet";

      state.embed.setFields({
        name: `🎭 Roles (${state.roles.size})`,
        value: rolesText,
      });

      await safeReply(interaction, {
        embeds: [state.embed],
        components: generateComponents(),
      });
    } catch (error) {
      logger.error("Error in updateMessage:", error);
      throw error; // Re-throw so the calling function can handle it
    }
  };

  await safeReply(interaction, {
    content:
      "🎨 **Reaction Role Message Builder**\nCreate a beautiful reaction role message with custom embed styling.",
    embeds: [state.embed],
    components: generateComponents(),
    ephemeral: true,
  });

  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({
    time: 600000, // 10 minutes
  });

  collector.on("collect", (i) => {
    void (async () => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "❌ You can't use these components.", ephemeral: true });
        return;
      }

      try {
        logger.debug(`Collector received interaction: ${i.customId} (type: ${i.constructor.name})`);

        // Handle both button and select menu interactions
        if (i.isButton()) {
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
                try {
                  logger.debug("Processing rr_title_modal submission");
                  await submitted.deferUpdate();
                  const title = submitted.fields.getTextInputValue("title");
                  logger.debug(`Setting title to: ${title}`);

                  // Validate title is not default
                  if (!title || title.trim() === "" || title === "New Reaction Role Message") {
                    await submitted.followUp({
                      content: "❌ Please enter a valid title for your reaction role message.",
                      ephemeral: true,
                    });
                    return;
                  }

                  state.embed.setTitle(title);
                  await updateMessage();
                  logger.debug("Successfully updated title");
                } catch (error) {
                  logger.error("Error processing rr_title_modal:", error);
                  await submitted.followUp({
                    content: "❌ An error occurred while updating the title. Please try again.",
                    ephemeral: true,
                  });
                }
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
                .setRequired(false);
              modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

              await i.showModal(modal);
              const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
              if (submitted) {
                try {
                  logger.debug("Processing rr_desc_modal submission");
                  await submitted.deferUpdate();
                  const description = submitted.fields.getTextInputValue("description");
                  logger.debug(`Setting description to: ${description?.substring(0, 50)}...`);
                  state.embed.setDescription(description || null);
                  await updateMessage();
                  logger.debug("Successfully updated description");
                } catch (error) {
                  logger.error("Error processing rr_desc_modal:", error);
                  await submitted.followUp({
                    content: "❌ An error occurred while updating the description. Please try again.",
                    ephemeral: true,
                  });
                }
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
                await emojiMessage.delete().catch(() => {
                  // Ignore deletion errors
                });
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
                try {
                  const roleId = roleInteraction.values[0];
                  const role = roleInteraction.guild?.roles.cache.get(roleId);

                  if (!role) {
                    await i.followUp({ content: "❌ Selected role no longer exists.", ephemeral: true });
                    await updateMessage();
                    return;
                  }

                  state.roles.set(emoji.name, roleId);

                  await roleInteraction.update({
                    content: `✅ Added: ${emoji.name} → **${role.name}**`,
                  });
                } catch (roleError) {
                  logger.error("Error in role selection:", roleError);
                  await i.followUp({ content: "❌ Error adding role. Please try again.", ephemeral: true });
                }
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
              // Check if title is set
              if (!state.embed.data.title || state.embed.data.title === "New Reaction Role Message") {
                await i.reply({
                  content: "❌ You need to set a title before posting. Use the 'Set Title' button first.",
                  ephemeral: true,
                });
                return;
              }

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
                try {
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
                        guildId: interaction.guild?.id ?? "",
                        channelId: channel.id,
                        messageId: finalMessage.id,
                        title: state.embed.data.title ?? "Reaction Roles",
                        description: state.embed.data.description,
                        embedColor: state.embed.data.color?.toString(),
                        createdBy: interaction.user.id,
                      });

                      await channelInteraction.editReply({
                        content: `✅ **Success!** Reaction role message posted in ${channel}!\n🔗 [Jump to message](${finalMessage.url})`,
                        components: [],
                      });

                      // Log the creation
                      if (interaction.guild) {
                        await client.logManager.log(interaction.guild.id, "REACTION_ROLE_MESSAGE_CREATE", {
                          userId: interaction.user.id,
                          channelId: channel.id,
                          metadata: {
                            messageId: finalMessage.id,
                            roleCount: state.roles.size,
                            roles: Array.from(state.roles.entries()),
                          },
                        });
                      }
                    } catch (error) {
                      logger.error("Error posting reaction role message:", error);
                      await channelInteraction.editReply({
                        content: "❌ Failed to post the message. Please check my permissions in that channel.",
                        components: [],
                      });
                    }
                  } else {
                    await i.followUp({ content: "❌ Selected channel is not a text channel.", ephemeral: true });
                  }
                } catch (channelError) {
                  logger.error("Error in channel selection:", channelError);
                  await i.followUp({ content: "❌ Error selecting channel. Please try again.", ephemeral: true });
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
        } else if (i.isStringSelectMenu() || i.isChannelSelectMenu()) {
          // Handle select menu interactions
          switch (i.customId) {
            case "color_select": {
              logger.debug("Processing color_select interaction via collector");
              // Acknowledge the interaction immediately to prevent other handlers from processing it
              await i.deferUpdate();
              try {
                if (i.values[0] === "custom") {
                  const modal = new ModalBuilder().setCustomId("custom_color_modal").setTitle("Custom Color");
                  const input = new TextInputBuilder()
                    .setCustomId("hex_color")
                    .setLabel("Hex Color Code (e.g., #FF0000)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

                  await i.showModal(modal);
                  const colorSubmitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
                  if (colorSubmitted) {
                    await colorSubmitted.deferUpdate();
                    const color = colorSubmitted.fields.getTextInputValue("hex_color");
                    if (/^#?[0-9A-F]{6}$/i.test(color)) {
                      const colorValue = color.startsWith("#") ? color : `#${color}`;
                      state.embed.setColor(colorValue as `#${string}`);
                      logger.debug(`Set custom color to: ${colorValue}`);
                    } else {
                      await i.followUp({
                        content: "❌ Invalid hex color format. Please use format like #FF0000.",
                        ephemeral: true,
                      });
                      return;
                    }
                  }
                } else {
                  const colorValue = parseInt(i.values[0]);
                  if (!isNaN(colorValue)) {
                    state.embed.setColor(colorValue);
                    logger.debug(`Set predefined color to: ${colorValue}`);
                  } else {
                    await i.followUp({ content: "❌ Invalid color value selected.", ephemeral: true });
                    return;
                  }
                }

                // Update the embed fields before sending
                const rolesText =
                  state.roles.size > 0
                    ? [...state.roles.entries()].map(([e, r]) => `${e} → <@&${r}>`).join("\n")
                    : "No roles added yet";

                logger.debug(`Setting embed fields - rolesText: "${rolesText}", rolesSize: ${state.roles.size}`);

                state.embed.setFields({
                  name: `🎭 Roles (${state.roles.size})`,
                  value: rolesText,
                });

                logger.debug(
                  `About to update interaction - embedColor: ${state.embed.data.color}, embedTitle: "${state.embed.data.title}", embedFields count: ${state.embed.data.fields?.length || 0}`
                );

                // Update the interaction reply since we deferred it
                await i.editReply({
                  embeds: [state.embed],
                  components: generateComponents(),
                });
                logger.debug("Successfully updated color");
              } catch (colorError) {
                logger.error(
                  `Error details - message: "${colorError instanceof Error ? colorError.message : "Unknown error"}", values: [${i.values}], embedColor: ${state.embed.data.color}`
                );
                await i.followUp({ content: "❌ Error setting color. Please try again.", ephemeral: true });
              }
              break;
            }
            case "role_select": {
              try {
                const roleId = i.values[0];
                const role = i.guild?.roles.cache.get(roleId);

                if (!role) {
                  await i.followUp({ content: "❌ Selected role no longer exists.", ephemeral: true });
                  await updateMessage();
                  return;
                }

                // Get the emoji from the state (this would need to be stored temporarily)
                // For now, we'll handle this in the button flow
                await i.update({
                  content: `✅ Role selected: **${role.name}**`,
                });
              } catch (roleError) {
                logger.error("Error in role selection:", roleError);
                await i.followUp({ content: "❌ Error selecting role. Please try again.", ephemeral: true });
              }
              await updateMessage();
              break;
            }
            case "channel_select": {
              if (!i.isChannelSelectMenu()) {
                await i.followUp({ content: "❌ Invalid interaction type for channel selection.", ephemeral: true });
                return;
              }
              try {
                const channel = i.channels.first();
                if (channel instanceof TextChannel) {
                  await i.deferUpdate();

                  // Validate that the bot can use all emojis before sending the message
                  const invalidEmojis: string[] = [];
                  for (const [emoji] of state.roles.entries()) {
                    try {
                      // Test if the bot can use this emoji
                      const testMessage = await channel.send({ content: "Testing emoji..." });
                      await testMessage.react(emoji);
                      await testMessage.delete();
                    } catch (emojiError) {
                      invalidEmojis.push(emoji);
                    }
                  }

                  if (invalidEmojis.length > 0) {
                    await i.editReply({
                      content: `❌ **Cannot use the following emojis:** ${invalidEmojis.join(", ")}\n\nPlease use emojis that are available to me in this server.`,
                      components: [],
                    });
                    return;
                  }

                  try {
                    const finalMessage = await channel.send({ embeds: [state.embed] });

                    // Add reactions and database entries with rollback on failure
                    const addedReactions: string[] = [];
                    const addedDbEntries: { emoji: string; roleId: string }[] = [];

                    try {
                      for (const [emoji, roleId] of state.roles.entries()) {
                        await finalMessage.react(emoji);
                        addedReactions.push(emoji);

                        await addReactionRole(interaction, finalMessage.id, emoji, roleId);
                        addedDbEntries.push({ emoji, roleId });
                      }

                      // Create reaction role message entry
                      await createReactionRoleMessage({
                        guildId: interaction.guild?.id ?? "",
                        channelId: channel.id,
                        messageId: finalMessage.id,
                        title: state.embed.data.title ?? "Reaction Roles",
                        description: state.embed.data.description,
                        embedColor: state.embed.data.color?.toString(),
                        createdBy: interaction.user.id,
                      });

                      await i.editReply({
                        content: `✅ **Success!** Reaction role message posted in ${channel}!\n🔗 [Jump to message](${finalMessage.url})`,
                        components: [],
                      });

                      // Log the creation
                      if (interaction.guild) {
                        await client.logManager.log(interaction.guild.id, "REACTION_ROLE_MESSAGE_CREATE", {
                          userId: interaction.user.id,
                          channelId: channel.id,
                          metadata: {
                            messageId: finalMessage.id,
                            roleCount: state.roles.size,
                            roles: Array.from(state.roles.entries()),
                          },
                        });
                      }
                    } catch (reactionError) {
                      logger.error("Error adding reactions:", reactionError);

                      // Rollback: Delete the message and remove database entries
                      try {
                        await finalMessage.delete();
                      } catch (deleteError) {
                        logger.error("Failed to delete message during rollback:", deleteError);
                      }

                      // Remove any database entries that were created
                      for (const { emoji, roleId } of addedDbEntries) {
                        try {
                          await removeReactionRole(client, finalMessage.id, emoji);
                        } catch (dbError) {
                          logger.error("Failed to remove database entry during rollback:", dbError);
                        }
                      }

                      await i.editReply({
                        content: `❌ **Failed to add reactions.** The message was deleted.\n\nError: ${reactionError instanceof Error ? reactionError.message : "Unknown error"}`,
                        components: [],
                      });
                      return;
                    }
                  } catch (messageError) {
                    logger.error("Error posting reaction role message:", messageError);
                    await i.editReply({
                      content: "❌ Failed to post the message. Please check my permissions in that channel.",
                      components: [],
                    });
                  }
                } else {
                  await i.followUp({ content: "❌ Selected channel is not a text channel.", ephemeral: true });
                }
              } catch (channelError) {
                logger.error("Error in channel selection:", channelError);
                await i.followUp({ content: "❌ Error selecting channel. Please try again.", ephemeral: true });
              }
              collector.stop();
              break;
            }
          }
        }
      } catch (error) {
        logger.error("Error in reaction role builder:", error);

        // Try to provide a more specific error message
        let errorMessage = "❌ An error occurred. Please try again.";

        if (error instanceof Error) {
          if (error.message.includes("Missing Permissions")) {
            errorMessage = "❌ I don't have the required permissions to perform this action.";
          } else if (error.message.includes("Unknown Message")) {
            errorMessage = "❌ The message was deleted or I can't access it.";
          } else if (error.message.includes("Invalid Form Body")) {
            errorMessage = "❌ Invalid input provided. Please check your selection.";
          }
        }

        try {
          if (!i.replied && !i.deferred) {
            await i.reply({ content: errorMessage, ephemeral: true });
          } else if (i.deferred) {
            await i.editReply({ content: errorMessage });
          } else {
            await i.followUp({ content: errorMessage, ephemeral: true });
          }
        } catch (replyError) {
          logger.error("Failed to send error message to user:", replyError);
        }
      }
    })();
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

export { handleMessageCreate };

async function handleMessageList(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const messages = await getReactionRoleMessagesByGuild(interaction.guild?.id ?? "");

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
    const message = await findMessageById(interaction.guild ?? ({} as Guild), messageId);
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
    if (interaction.guild) {
      await client.logManager.log(interaction.guild.id, "REACTION_ROLE_MESSAGE_DELETE", {
        userId: interaction.user.id,
        channelId: message.channelId,
        metadata: {
          messageId: messageId,
          deletedAt: new Date().toISOString(),
        },
      });
    }
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

  const message = await findMessageById(interaction.guild ?? ({} as Guild), messageId);
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
    // First attempt to react to ensure the bot can use this emoji
    await message.react(emoji.name);

    const dbResult = await addReactionRole(interaction, messageId, emojiRaw, role.id);
    if (!dbResult) {
      // Revert the reaction since DB insert failed (likely duplicate)
      await message.reactions.resolve(emoji.identifier)?.remove();
      await interaction.followUp({
        content: "❌ Failed to add reaction role. This emoji may already be in use for this message.",
        ephemeral: true,
      });
      return;
    }

    await interaction.followUp({
      content: `✅ **Success!** Added reaction role: ${emoji.name} → **${role.name}**`,
      ephemeral: true,
    });

    // Log the addition
    if (interaction.guild) {
      await client.logManager.log(interaction.guild.id, "REACTION_ROLE_CONFIG_ADD", {
        userId: interaction.user.id,
        channelId: message.channelId,
        roleId: role.id,
        metadata: {
          emoji: emojiRaw,
          roleName: role.name,
          messageId: messageId,
        },
      });
    }
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

  const message = await findMessageById(interaction.guild ?? ({} as Guild), messageId);
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
    if (interaction.guild) {
      await client.logManager.log(interaction.guild.id, "REACTION_ROLE_CONFIG_REMOVE", {
        userId: interaction.user.id,
        channelId: message.channelId,
        metadata: {
          emoji: emojiRaw,
          messageId: messageId,
        },
      });
    }
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
      // r.emoji may be stored as "id:name" for custom emojis. Extract the ID before fetching.
      const [emojiId] = r.emoji.split(":");
      const fetchedEmoji = client.emojis.cache.get(emojiId);
      const emoji = fetchedEmoji ?? r.emoji;
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

/**
 * Reaction Roles Command - Manage reaction role system
 */
export class ReactionRolesCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "reactionroles",
      description: "ADMIN ONLY: Manage reaction role system",
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
        case "create": {
          await handleMessageCreate(this.client, this.interaction as GuildChatInputCommandInteraction);
          return { content: "🔧 Reaction role wizard started.", ephemeral: true };
        }
        case "list":
          return await this.handleList();
        case "remove":
          return await this.handleRemove();
        case "clear":
          return await this.handleClear();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in reaction roles command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleList(): Promise<CommandResponse> {
    try {
      const reactionRoles = await prisma.reactionRole.findMany({
        where: { guildId: this.guild.id },
        orderBy: { createdAt: "desc" },
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🎭 Reaction Roles")
        .setTimestamp()
        .setFooter({ text: `Server: ${this.guild.name}` });

      if (reactionRoles.length === 0) {
        embed.setDescription("❌ No reaction roles configured for this server.");
        embed.addFields({
          name: "💡 Getting Started",
          value: "Use `/addreactionrole` to create reaction roles.",
          inline: false,
        });

        return { embeds: [embed], ephemeral: true };
      }

      embed.setDescription(
        `**${reactionRoles.length}** reaction role${reactionRoles.length === 1 ? "" : "s"} configured.`
      );

      // Group by channel-message to collate roles; allow undefined entries initially
      const messageGroups: Partial<Record<string, typeof reactionRoles>> = {};
      for (const rr of reactionRoles) {
        const key = `${rr.channelId}-${rr.messageId}`;
        (messageGroups[key] ??= []).push(rr);
      }

      const fields: { name: string; value: string; inline: boolean }[] = [];
      let fieldCount = 0;

      for (const [key, roles] of Object.entries(messageGroups)) {
        if (!roles) continue; // Shouldn't happen but satisfies type checker
        if (fieldCount >= 25) break; // Discord embed field limit

        const firstRole = roles[0];
        const channel = this.guild.channels.cache.get(firstRole.channelId);

        const rolesList = roles
          .map((rr) => {
            const roleList = rr.roleIds
              .map((roleId) => {
                const roleObj = this.guild.roles.cache.get(roleId);
                return roleObj ? roleObj.toString() : `<@&${roleId}> (Deleted)`;
              })
              .join(", ");
            return `${rr.emoji} → ${roleList}`;
          })
          .join("\n");

        fields.push({
          name: `#${channel?.name ?? "Unknown Channel"}`,
          value: [
            `**Message:** [Jump to Message](https://discord.com/channels/${this.guild.id}/${firstRole.channelId}/${firstRole.messageId})`,
            `**Roles:**\n${rolesList}`,
          ].join("\n"),
          inline: false,
        });

        fieldCount++;
      }

      embed.addFields(fields);

      if (fieldCount >= 25 && Object.keys(messageGroups).length > 25) {
        embed.addFields({
          name: "⚠️ Display Limit",
          value: `Showing first 25 messages. Total: ${Object.keys(messageGroups).length} messages with reaction roles.`,
          inline: false,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error listing reaction roles:", error);
      return {
        content: `❌ Failed to list reaction roles: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleRemove(): Promise<CommandResponse> {
    const messageId = this.getStringOption("message_id", true);
    const emoji = this.getStringOption("emoji");

    try {
      if (emoji) {
        // Remove specific emoji-role mapping
        const deleted = await prisma.reactionRole.deleteMany({
          where: {
            guildId: this.guild.id,
            messageId: messageId,
            emoji: emoji,
          },
        });

        if (deleted.count === 0) {
          return {
            content: `❌ No reaction role found for emoji \`${emoji}\` on message \`${messageId}\`.`,
            ephemeral: true,
          };
        }

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Reaction Role Removed")
          .setDescription(`Removed reaction role for emoji \`${emoji}\` on message \`${messageId}\`.`)
          .setTimestamp();

        // Log removal
        await this.client.logManager.log(this.guild.id, "REACTION_ROLE_REMOVED", {
          userId: this.user.id,
          metadata: {
            messageId,
            emoji,
            count: deleted.count,
          },
        });

        return { embeds: [embed], ephemeral: true };
      } else {
        // Remove all reaction roles for the message
        const deleted = await prisma.reactionRole.deleteMany({
          where: {
            guildId: this.guild.id,
            messageId: messageId,
          },
        });

        if (deleted.count === 0) {
          return {
            content: `❌ No reaction roles found for message \`${messageId}\`.`,
            ephemeral: true,
          };
        }

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Reaction Roles Removed")
          .setDescription(
            `Removed **${deleted.count}** reaction role${deleted.count === 1 ? "" : "s"} from message \`${messageId}\`.`
          )
          .setTimestamp();

        // Log removal
        await this.client.logManager.log(this.guild.id, "REACTION_ROLES_REMOVED", {
          userId: this.user.id,
          metadata: {
            messageId,
            count: deleted.count,
          },
        });

        return { embeds: [embed], ephemeral: true };
      }
    } catch (error) {
      logger.error("Error removing reaction role:", error);
      return {
        content: `❌ Failed to remove reaction role: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleClear(): Promise<CommandResponse> {
    const channelId = this.getStringOption("channel_id");

    try {
      // Clear reaction roles (specific channel if provided, else entire guild)
      const deleted = await prisma.reactionRole.deleteMany({
        where: channelId ? { guildId: this.guild.id, channelId } : { guildId: this.guild.id },
      });

      if (deleted.count === 0) {
        return {
          content: channelId
            ? `❌ No reaction roles found in channel <#${channelId}>.`
            : "❌ No reaction roles found in this server.",
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🧹 Reaction Roles Cleared")
        .setDescription(
          channelId
            ? `Removed **${deleted.count}** reaction role${deleted.count === 1 ? "" : "s"} from <#${channelId}>.`
            : `Removed **${deleted.count}** reaction role${deleted.count === 1 ? "" : "s"} from this server.`
        )
        .addFields({
          name: "⚠️ Important",
          value: "This action cannot be undone. You'll need to recreate any reaction roles you want to keep.",
          inline: false,
        })
        .setTimestamp();

      // Notify API of reaction role changes
      const customClient = this.client as any as Client;
      if (customClient.queueService) {
        try {
          customClient.queueService.processRequest({
            type: "CONFIG_UPDATE",
            data: {
              guildId: this.guild.id,
              section: "REACTION_ROLES",
              changes: { cleared: true, channelId, count: deleted.count },
              action: "CLEAR_REACTION_ROLES",
              updatedBy: this.user.id,
            },
            source: "rest",
            userId: this.user.id,
            guildId: this.guild.id,
            requiresReliability: true,
          });
        } catch (error) {
          console.warn("Failed to notify API of reaction role clear:", error);
        }
      }

      // Log clearing
      await this.client.logManager.log(this.guild.id, "REACTION_ROLES_CLEARED", {
        userId: this.user.id,
        metadata: {
          channelId,
          count: deleted.count,
        },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error clearing reaction roles:", error);
      return {
        content: `❌ Failed to clear reaction roles: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new ReactionRolesCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("reactionroles")
  .setDescription("ADMIN ONLY: Manage reaction role system")
  .addSubcommand((sub) => sub.setName("list").setDescription("List all reaction roles in this server"))
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove reaction role(s) from a message")
      .addStringOption((opt) =>
        opt.setName("message_id").setDescription("ID of the message to remove reaction roles from").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("emoji").setDescription("Specific emoji to remove (leave empty to remove all)")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear reaction roles from channel or entire server")
      .addStringOption((opt) =>
        opt.setName("channel_id").setDescription("Channel ID to clear (leave empty to clear entire server)")
      )
  )
  .addSubcommand((sub) => sub.setName("create").setDescription("Create a new reaction role message (wizard)"));
