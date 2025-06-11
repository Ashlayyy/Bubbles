import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder().setName("Add Reaction Role").setType(ApplicationCommandType.Message),
  async (_client: Client, interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    const modal = new ModalBuilder()
      .setCustomId(`add-reaction-role-modal-${interaction.targetMessage.id}`)
      .setTitle("Add Reaction Role");

    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji")
      .setLabel("Emoji")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId("role")
      .setLabel("Role ID or Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );

    await interaction.showModal(modal);
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
    },
  }
);
