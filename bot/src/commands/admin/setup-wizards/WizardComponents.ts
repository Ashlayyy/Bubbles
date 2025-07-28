import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
} from "discord.js";

// Standard button styles
export const BUTTON_STYLES = {
  PRIMARY: ButtonStyle.Primary,
  SECONDARY: ButtonStyle.Secondary,
  SUCCESS: ButtonStyle.Success,
  DANGER: ButtonStyle.Danger,
} as const;

// Standard emojis for each wizard type
export const WIZARD_EMOJIS = {
  APPEALS: "⚖️",
  AUTOMOD: "🧙‍♂️",
  LOGGING: "🗂️",
  TICKETS: "🎫",
  WELCOME: "👋",
  REACTION_ROLES: "🎭",
} as const;

// Unified color scheme for all wizards
export const WIZARD_COLORS = {
  PRIMARY: 0x3498db, // Blue - main wizard color
  SUCCESS: 0x2ecc71, // Green - success actions
  WARNING: 0xf39c12, // Orange - warnings/important
  DANGER: 0xe74c3c, // Red - destructive actions
  INFO: 0x9b59b6, // Purple - information
  NEUTRAL: 0x95a5a6, // Gray - neutral states
} as const;

// Create a standard channel select menu
export function createChannelSelect(
  customId: string,
  placeholder: string,
  minValues = 1,
  maxValues = 1
): ChannelSelectMenuBuilder {
  return new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(minValues)
    .setMaxValues(maxValues);
}

// Create a standard role select menu
export function createRoleSelect(
  customId: string,
  placeholder: string,
  minValues = 0,
  maxValues = 5
): RoleSelectMenuBuilder {
  return new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(minValues)
    .setMaxValues(maxValues);
}

// Create a standard toggle button
export function createToggleButton(enabled: boolean, customId: string, label: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(enabled ? `Disable ${label}` : `Enable ${label}`)
    .setStyle(enabled ? BUTTON_STYLES.DANGER : BUTTON_STYLES.SUCCESS);
}

// Create a standard test button
export function createTestButton(customId: string, label = "Test"): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.PRIMARY);
}

// Create a standard back button
export function createBackButton(customId: string, label = "← Back"): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.SECONDARY);
}

// Create a standard continue button
export function createContinueButton(customId: string, label = "Continue →"): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.SUCCESS);
}

// Create a standard help button
export function createHelpButton(customId: string, label = "❓ Help & Info"): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.SECONDARY);
}

// Create a standard quick setup button
export function createQuickSetupButton(customId: string, label = "⚡ Quick Setup"): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.SUCCESS);
}

// Create a standard preset button
export function createPresetButton(customId: string, label: string, emoji?: string): ButtonBuilder {
  const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(BUTTON_STYLES.PRIMARY);

  if (emoji) {
    button.setEmoji(emoji);
  }

  return button;
}

// Create a standard action row with buttons
export function createButtonRow(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

// Create a standard action row with channel select
export function createChannelSelectRow(select: ChannelSelectMenuBuilder): ActionRowBuilder<ChannelSelectMenuBuilder> {
  return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select);
}

// Create a standard action row with role select
export function createRoleSelectRow(select: RoleSelectMenuBuilder): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);
}

// Create preset buttons for common wizard patterns
export function createPresetButtons(
  presets: { id: string; label: string; emoji?: string }[]
): ActionRowBuilder<ButtonBuilder> {
  const buttons = presets.map((preset) => createPresetButton(preset.id, preset.label, preset.emoji));
  return createButtonRow(...buttons);
}

// Create navigation buttons (back, continue, help)
export function createNavigationButtons(
  backId: string,
  continueId?: string,
  helpId?: string
): ActionRowBuilder<ButtonBuilder> {
  const buttons = [createBackButton(backId)];

  if (continueId) {
    buttons.push(createContinueButton(continueId));
  }

  if (helpId) {
    buttons.push(createHelpButton(helpId));
  }

  return createButtonRow(...buttons);
}

// Create main action buttons (enable/disable, test, etc.)
export function createActionButtons(
  actions: { id: string; label: string; style: ButtonStyle; emoji?: string }[]
): ActionRowBuilder<ButtonBuilder> {
  const buttons = actions.map((action) => {
    const button = new ButtonBuilder().setCustomId(action.id).setLabel(action.label).setStyle(action.style);

    if (action.emoji) {
      button.setEmoji(action.emoji);
    }

    return button;
  });

  return createButtonRow(...buttons);
}
