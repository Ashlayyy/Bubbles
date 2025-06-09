import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { addReactionRole } from "../../../database/ReactionRoles.js";
import logger from "../../../logger.js";
import Command from "../../../structures/Command.js";

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

    const roleInput = new RoleSelectMenuBuilder().setCustomId("role_select");

    // As we discovered, we cannot add a role selector to a modal.
    // I must ask for the role in a follow-up interaction.

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
        ephemeral: true,
      });
      const roleMessage = await submitted.fetchReply();

      const roleInteraction = await roleMessage.awaitMessageComponent({ time: 30000 }).catch(() => null);

      if (roleInteraction?.isRoleSelectMenu()) {
        const roleId = roleInteraction.values[0];
        const message = interaction.targetMessage;

        try {
          await addReactionRole(interaction, message.id, emoji, roleId);
          await message.react(emoji);
          await roleInteraction.update({ content: "✅ Role added!", components: [] });
        } catch (error) {
          logger.error("Error adding reaction role from context menu:", error);
          await roleInteraction.update({ content: "❌ Failed to add role.", components: [] });
        }
      } else {
        await interaction.followUp({ content: "You did not select a role in time.", ephemeral: true });
      }
    }
  }
);
