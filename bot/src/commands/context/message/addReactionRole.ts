import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { addReactionRole } from "../../../database/ReactionRoles.js";
import { parseEmoji } from "../../../functions/general/emojis.js";
import logger from "../../../logger.js";
import Command from "../../../structures/Command.js";
import { PermissionLevel } from "../../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder().setName("Add Reaction Role").setType(ApplicationCommandType.Message),
  async (client, interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    const modal = new ModalBuilder().setCustomId("add_reaction_role_modal").setTitle("Add Reaction Role");

    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji_input")
      .setLabel("Emoji")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput));

    await interaction.showModal(modal);
    const submitted = await interaction.awaitModalSubmit({ time: 60000 }).catch(() => null);

    if (submitted) {
      const emoji = submitted.fields.getTextInputValue("emoji_input");
      const roleSelect = new RoleSelectMenuBuilder().setCustomId("add_rr_role_select").setMaxValues(1);
      const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);

      await submitted.reply({
        content: `Emoji set to ${emoji}. Now select the role.`,
        components: [roleRow],
        flags: MessageFlags.Ephemeral,
      });
      const roleMessage = await submitted.fetchReply();

      const roleInteraction = await roleMessage.awaitMessageComponent({ time: 30000 }).catch(() => null);

      if (roleInteraction?.isRoleSelectMenu()) {
        const roleId = roleInteraction.values[0];
        const message = interaction.targetMessage;

        const parsedEmoji = parseEmoji(emoji, client);
        if (!parsedEmoji) {
          await roleInteraction.update({ content: "❌ That doesn't seem to be a valid emoji.", components: [] });
          return;
        }

        try {
          await addReactionRole(interaction, message.id, emoji, roleId);
          if (interaction.guild) {
            await client.logManager.log(interaction.guild.id, "REACTION_ROLE_ADD", {
              userId: interaction.user.id,
              channelId: message.channel.id,
              metadata: {
                messageId: message.id,
                emoji,
                roleId,
              },
            });
          }
          await message.react(parsedEmoji.name);
          await roleInteraction.update({ content: "✅ Role added!", components: [] });
        } catch (error) {
          logger.error("Error adding reaction role from context menu:", error);
          await roleInteraction.update({ content: "❌ Failed to add role.", components: [] });
        }
      } else {
        await interaction.followUp({ content: "You did not select a role in time.", ephemeral: true });
      }
    }
  },
  {
    enabledOnDev: false,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.ManageRoles],
      isConfigurable: true,
    },
  }
);
