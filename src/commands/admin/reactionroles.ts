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
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import type { ReactionRole } from "@prisma/client";
import { addReactionRole, getReactionRolesByMessage, removeReactionRole } from "../../database/ReactionRoles.js";
import { parseEmoji } from "../../functions/general/emojis.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import Command, { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Main command builder
const commandBuilder = new SlashCommandBuilder()
  .setName("reaction-roles")
  .setDescription("Manage reaction roles for your server")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand.setName("builder").setDescription("Create a new reaction role message using an interactive builder.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add a reaction role to an existing message.")
      .addStringOption((option) =>
        option.setName("message_id").setDescription("The ID of the message to add the role to.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("emoji").setDescription("The emoji for the reaction.").setRequired(true)
      )
      .addRoleOption((option) => option.setName("role").setDescription("The role to assign.").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove a reaction role from a message.")
      .addStringOption((option) =>
        option.setName("message_id").setDescription("The ID of the message to remove the role from.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("emoji").setDescription("The emoji of the reaction role to remove.").setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List all reaction roles configured for a message.")
      .addStringOption((option) =>
        option.setName("message_id").setDescription("The ID of the message to list roles for.").setRequired(true)
      )
  );

// Functions for subcommands
async function findMessageById(guild: Guild, messageId: string): Promise<Message | null> {
  const channels = guild.channels.cache.filter((c) => c instanceof TextChannel) as Map<string, TextChannel>;
  for (const channel of channels.values()) {
    try {
      return await channel.messages.fetch(messageId);
    } catch (error) {
      // Ignore errors (message not in this channel)
    }
  }
  return null;
}

async function handleAdd(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

  if (!interaction.guild) {
    await interaction.followUp({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  const emojiRaw = interaction.options.getString("emoji", true);
  const role = interaction.options.getRole("role", true);

  const message = await findMessageById(interaction.guild, messageId);
  if (!message) {
    await interaction.followUp({
      content: "Could not find a message with that ID.",
      ephemeral: true,
    });
    return;
  }

  const emoji = parseEmoji(emojiRaw, client);
  if (!emoji) {
    await interaction.followUp({
      content: "That doesn't seem to be a valid emoji I can use.",
      ephemeral: true,
    });
    return;
  }

  try {
    const dbResult = await addReactionRole(interaction, messageId, emojiRaw, role.id);
    if (!dbResult) {
      await interaction.followUp({
        content: "Failed to add reaction role. The emoji may not be valid.",
        ephemeral: true,
      });
      return;
    }
    await message.react(emoji.name);
    await interaction.followUp({
      content: `Successfully added reaction role: ${emoji.name} -> ${role.name}`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error adding reaction role:", error);
    await interaction.followUp({
      content: "Failed to add reaction role. Please check my permissions.",
      ephemeral: true,
    });
  }
}

async function handleRemove(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

  if (!interaction.guild) {
    await interaction.followUp({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  const emojiRaw = interaction.options.getString("emoji", true);

  const message = await findMessageById(interaction.guild, messageId);
  if (!message) {
    await interaction.followUp({
      content: "Could not find a message with that ID.",
      ephemeral: true,
    });
    return;
  }

  const emoji = parseEmoji(emojiRaw, client);
  if (!emoji) {
    await interaction.followUp({
      content: "That doesn't seem to be a valid emoji.",
      ephemeral: true,
    });
    return;
  }

  try {
    await removeReactionRole(client, messageId, emojiRaw);
    // Remove all reactions for this emoji
    await message.reactions.resolve(emoji.identifier)?.remove();
    await interaction.followUp({
      content: `Successfully removed reaction role for ${emoji.name}.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error removing reaction role:", error);
    await interaction.followUp({
      content: "Failed to remove reaction role.",
      ephemeral: true,
    });
  }
}

async function handleList(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  const messageId = interaction.options.getString("message_id", true);

  const roles = await getReactionRolesByMessage(messageId);

  if (roles.length === 0) {
    await interaction.followUp({
      content: "No reaction roles are configured for that message.",
      ephemeral: true,
    });
    return;
  }

  const roleMentions = roles
    .map((r: ReactionRole) => {
      // r.emoji is the identifier. For custom emojis, it's an ID. For standard, it's the unicode char.
      const emoji = client.emojis.cache.get(r.emoji) ?? r.emoji;
      return `${emoji} -> <@&${r.roleIds[0]}>`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Configured Reaction Roles")
    .setDescription(roleMentions)
    .setColor("Blue")
    .setFooter({ text: `Message ID: ${messageId}` });

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

interface BuilderState {
  embed: EmbedBuilder;
  roles: Map<string, string>; // emoji -> roleId
}

async function handleBuilder(client: Client, interaction: GuildChatInputCommandInteraction) {
  const state: BuilderState = {
    embed: new EmbedBuilder()
      .setTitle("New Reaction Role Embed")
      .setDescription("Use the buttons below to build your embed."),
    roles: new Map(),
  };

  const generateComponents = (isRoleAdding = false) => {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("rr_builder_title")
        .setLabel("Set Title")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isRoleAdding),
      new ButtonBuilder()
        .setCustomId("rr_builder_desc")
        .setLabel("Set Description")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isRoleAdding),
      new ButtonBuilder()
        .setCustomId("rr_builder_color")
        .setLabel("Set Color")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isRoleAdding),
      new ButtonBuilder()
        .setCustomId("rr_builder_add_role")
        .setLabel("Add Role")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isRoleAdding),
      new ButtonBuilder()
        .setCustomId("rr_builder_post")
        .setLabel("Post Embed")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isRoleAdding || state.roles.size === 0)
    );
    return [row];
  };

  const updateMessage = async () => {
    const rolesList =
      Array.from(state.roles.entries())
        .map(([emoji, roleId]) => `${emoji} -> <@&${roleId}>`)
        .join("\n") || "No roles added yet.";
    state.embed.setFields([{ name: "Roles", value: rolesList }]);
    await interaction.editReply({
      embeds: [state.embed],
      components: generateComponents(),
    });
  };

  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  await interaction.followUp({
    embeds: [state.embed],
    components: generateComponents(),
    ephemeral: true,
  });
  const reply = await interaction.fetchReply();

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 600000, // 10 minutes
  });

  collector.on("collect", (i) => {
    void (async () => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "You can't use these buttons.", ephemeral: true });
        return;
      }

      switch (i.customId) {
        case "rr_builder_title": {
          const modal = new ModalBuilder().setCustomId("rr_builder_title_modal").setTitle("Set Embed Title");
          const modalInput = new TextInputBuilder()
            .setCustomId("title_input")
            .setLabel("Title")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(modalInput));
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
          if (submitted) {
            state.embed.setTitle(submitted.fields.getTextInputValue("title_input"));
            await submitted.deferUpdate();
            await updateMessage();
          }
          break;
        }
        case "rr_builder_desc": {
          const modal = new ModalBuilder().setCustomId("rr_builder_desc_modal").setTitle("Set Embed Description");
          const modalInput = new TextInputBuilder()
            .setCustomId("desc_input")
            .setLabel("Description")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(modalInput));
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
          if (submitted) {
            state.embed.setDescription(submitted.fields.getTextInputValue("desc_input"));
            await submitted.deferUpdate();
            await updateMessage();
          }
          break;
        }
        case "rr_builder_color": {
          const modal = new ModalBuilder().setCustomId("rr_builder_color_modal").setTitle("Set Embed Color");
          const modalInput = new TextInputBuilder()
            .setCustomId("color_input")
            .setLabel("Hex Color Code (e.g., #FF0000)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(modalInput));
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);
          if (submitted) {
            const color = submitted.fields.getTextInputValue("color_input");
            if (/^#[0-9A-F]{6}$/i.test(color)) {
              state.embed.setColor(color as `#${string}`);
            }
            await submitted.deferUpdate();
            await updateMessage();
          }
          break;
        }
        case "rr_builder_add_role": {
          await i.update({
            content: "Please send the emoji for the new role in the chat.",
            embeds: [],
            components: [],
          });

          const emojiFilter = (m: Message) => m.author.id === interaction.user.id;
          const collected = await interaction.channel
            ?.awaitMessages({ filter: emojiFilter, max: 1, time: 30000, errors: ["time"] })
            .catch(() => null);
          const emojiMessage = collected?.first();

          if (emojiMessage) {
            await emojiMessage.delete().catch((err: unknown) => logger.error("Could not delete emoji message", err));
          }

          const emojiRaw = emojiMessage?.content;

          if (!emojiRaw) {
            await interaction.followUp({ content: "You did not provide an emoji in time.", ephemeral: true });
            await updateMessage();
            return;
          }

          const emoji = parseEmoji(emojiRaw, client);

          if (!emoji) {
            await interaction.followUp({ content: "That does not appear to be a valid emoji.", ephemeral: true });
            await updateMessage();
            return;
          }

          const roleSelect = new RoleSelectMenuBuilder().setCustomId("rr_builder_role_select").setMaxValues(1);
          const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
          const roleMessage = await interaction.followUp({
            content: `Emoji set to ${emoji.name}. Now select the role.`,
            components: [roleRow],
            ephemeral: true,
          });

          const roleInteraction = await roleMessage
            .awaitMessageComponent({ componentType: ComponentType.RoleSelect, time: 30000 })
            .catch(() => null);

          if (roleInteraction) {
            const roleId = roleInteraction.values[0];
            state.roles.set(emoji.name, roleId);
            await roleInteraction.update({
              content: `✅ Role <@&${roleId}> added for ${emoji.name}!`,
              components: [],
            });
          } else {
            await interaction.followUp({ content: "You did not select a role in time.", ephemeral: true });
          }

          await updateMessage();
          break;
        }
        case "rr_builder_post": {
          const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId("rr_builder_channel_select")
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder("Select a channel to post the embed");
          const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
          await i.update({ content: "Select a channel to post the embed in.", embeds: [], components: [channelRow] });
          const postMessage = await i.fetchReply();

          const channelInteraction = await postMessage
            .awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 60000 })
            .catch(() => null);

          if (channelInteraction) {
            const channel = channelInteraction.channels.first();
            if (channel instanceof TextChannel) {
              const finalMessage = await channel.send({ embeds: [state.embed] });

              for (const [emoji, roleId] of state.roles.entries()) {
                await finalMessage.react(emoji);
                await addReactionRole(interaction, finalMessage.id, emoji, roleId);
              }

              await channelInteraction.update({
                content: `✅ Reaction role embed posted in ${channel}!`,
                components: [],
              });
            }
          } else {
            await interaction.followUp({ content: "You did not select a channel in time.", ephemeral: true });
          }
          collector.stop();
          break;
        }
      }
    })();
  });

  collector.on("end", (collected, reason) => {
    if (reason !== "user") {
      void (async () => {
        await interaction.editReply({ content: "Builder timed out.", components: [] });
      })();
    }
  });
}

// Main command logic
export default new Command(
  commandBuilder,
  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "add":
        await handleAdd(client, interaction);
        break;
      case "remove":
        await handleRemove(client, interaction);
        break;
      case "list":
        await handleList(client, interaction);
        break;
      case "builder":
        await handleBuilder(client, interaction);
        break;
      default:
        await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
    },
  }
);
