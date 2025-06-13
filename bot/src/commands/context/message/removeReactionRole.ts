import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { removeReactionRole } from "../../../database/ReactionRoles.js";
import { parseEmoji } from "../../../functions/general/emojis.js";
import logger from "../../../logger.js";
import Command from "../../../structures/Command.js";
import { PermissionLevel } from "../../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder().setName("Remove Reaction Role").setType(ApplicationCommandType.Message),
  async (client, interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    const modal = new ModalBuilder().setCustomId("remove_reaction_role_modal").setTitle("Remove Reaction Role");

    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji_input")
      .setLabel("Emoji of the role to remove")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput));

    await interaction.showModal(modal);
    const submitted = await interaction.awaitModalSubmit({ time: 60000 }).catch(() => null);

    if (submitted) {
      const emojiRaw = submitted.fields.getTextInputValue("emoji_input");
      const message = interaction.targetMessage;

      const emoji = parseEmoji(emojiRaw, client);
      if (!emoji) {
        await submitted.reply({ content: "❌ That doesn't seem to be a valid emoji.", ephemeral: true });
        return;
      }

      try {
        await removeReactionRole(client, message.id, emojiRaw);
        await message.reactions.resolve(emoji.identifier)?.remove();
        if (interaction.guild) {
          await client.logManager.log(interaction.guild.id, "REACTION_ROLE_REMOVE", {
            userId: interaction.user.id,
            channelId: message.channel.id,
            metadata: {
              messageId: message.id,
              emoji: emojiRaw,
            },
          });
        }
        await submitted.reply({ content: `✅ Role for ${emoji.name} removed!`, ephemeral: true });
      } catch (error) {
        logger.error("Error removing reaction role from context menu:", error);
        await submitted.reply({ content: "❌ Failed to remove role.", ephemeral: true });
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
