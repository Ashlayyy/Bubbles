import type { EmbedBuilder } from "discord.js";
import type Client from "../../structures/Client.js";

export type ModerationActionType =
  | "BAN"
  | "KICK"
  | "TIMEOUT"
  | "UNBAN"
  | "UNTIMEOUT"
  | "WARN"
  | "NOTE"
  | "PURGE"
  | "MASSBAN"
  | "BULK";

export interface ModCaseEmbedUser {
  id: string;
  username: string;
  avatarURL?: string | null;
}

export interface ModCaseEmbedOptions {
  action: ModerationActionType;
  title?: string;
  target: ModCaseEmbedUser;
  moderator: ModCaseEmbedUser;
  reason?: string | null;
  durationSeconds?: number | null;
  caseNumber?: number | null;
  notified?: boolean | null;
  timestamp?: Date | null;
  thumbnailUser?: "target" | "moderator" | "none";
}

type Translator = (key: string, options?: Record<string, unknown>) => Promise<string>;

const ACTION_TO_EMOJI: Record<ModerationActionType, string> = {
  BAN: "⛔",
  KICK: "👢",
  TIMEOUT: "⏱️",
  UNBAN: "🔓",
  UNTIMEOUT: "🔊",
  WARN: "⚠️",
  NOTE: "📝",
  PURGE: "🧹",
  MASSBAN: "🔨",
  BULK: "📦",
};

const ACTION_TO_COLOR: Record<ModerationActionType, number> = {
  BAN: 0xe74c3c, // red
  KICK: 0xe67e22, // orange
  TIMEOUT: 0x3498db, // blue
  UNBAN: 0x2ecc71, // green
  UNTIMEOUT: 0x2ecc71, // green
  WARN: 0xf1c40f, // yellow
  NOTE: 0x95a5a6, // gray
  PURGE: 0x95a5a6, // gray
  MASSBAN: 0x9b59b6, // purple
  BULK: 0x9b59b6, // purple
};

function formatDuration(seconds: number): string {
  const units = [
    { name: "year", seconds: 365 * 24 * 60 * 60 },
    { name: "month", seconds: 30 * 24 * 60 * 60 },
    { name: "week", seconds: 7 * 24 * 60 * 60 },
    { name: "day", seconds: 24 * 60 * 60 },
    { name: "hour", seconds: 60 * 60 },
    { name: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${String(count)} ${unit.name}${count !== 1 ? "s" : ""}`;
    }
  }
  return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
}

export interface ModCaseTheme {
  variant: "compact" | "standard" | "detailed";
  showCaseField: boolean;
  showTypeInTitle: boolean;
  showThumbnails: boolean;
  showNotifiedField: boolean;
  showDurationField: boolean;
  mentionStyle: "mention" | "tag" | "id" | "username";
  reasonMaxLength: number | null;
  colorOverride?: number;
}

const DEFAULT_THEME: ModCaseTheme = {
  variant: "standard",
  showCaseField: true,
  showTypeInTitle: true,
  showThumbnails: true,
  showNotifiedField: true,
  showDurationField: true,
  mentionStyle: "mention",
  reasonMaxLength: 800,
};

function formatUserValue(user: ModCaseEmbedUser, style: ModCaseTheme["mentionStyle"]): string {
  switch (style) {
    case "mention":
      return `<@${user.id}>`;
    case "tag":
    case "username":
      return user.username;
    case "id":
      return user.id;
    default:
      return `<@${user.id}>`;
  }
}

export async function buildModCaseEmbed(
  client: Client,
  t: Translator,
  options: ModCaseEmbedOptions,
  themeOverrides?: Partial<ModCaseTheme>
): Promise<EmbedBuilder> {
  const { action, title, target, moderator, reason, durationSeconds, caseNumber, notified, timestamp, thumbnailUser } =
    options;
  const theme: ModCaseTheme = { ...DEFAULT_THEME, ...(themeOverrides ?? {}) };

  const emoji = ACTION_TO_EMOJI[action];
  const color = ACTION_TO_COLOR[action];

  const typeLabel = await t(`moderation:common.types.${action}`);
  const labels = {
    case: await t("moderation:common.labels.case"),
    type: await t("moderation:common.labels.type"),
    target: await t("moderation:common.labels.target"),
    moderator: await t("moderation:common.labels.moderator"),
    reason: await t("moderation:common.labels.reason"),
    duration: await t("moderation:common.labels.duration"),
    notified: await t("moderation:common.labels.notified"),
  };

  const noReason = await t("moderation:common.values.noReason");

  const titleText = (() => {
    const base = title ?? `${emoji} ${typeLabel}`;
    if (!theme.showTypeInTitle) return title ?? `${emoji}`;
    if (theme.variant === "compact" && caseNumber != null) return `${base} • #${String(caseNumber)}`;
    return base;
  })();

  const embed = client.genEmbed({
    title: titleText,
    color: theme.colorOverride ?? color,
    timestamp: timestamp ?? new Date(),
    thumbnail:
      theme.showThumbnails && thumbnailUser !== "none"
        ? {
            url:
              (thumbnailUser === "moderator" ? moderator.avatarURL : target.avatarURL) ??
              target.avatarURL ??
              moderator.avatarURL ??
              undefined,
          }
        : undefined,
    fields: (() => {
      const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

      if (theme.variant !== "compact" && theme.showCaseField && caseNumber != null) {
        fields.push({ name: labels.case, value: `#${String(caseNumber)}`, inline: true });
      }

      // Type
      const typeValue =
        action === "TIMEOUT" && typeof durationSeconds === "number" && durationSeconds > 0
          ? `${typeLabel} (${formatDuration(durationSeconds)})`
          : typeLabel;
      fields.push({ name: labels.type, value: typeValue, inline: true });

      // Moderator / Target
      fields.push({ name: labels.moderator, value: formatUserValue(moderator, theme.mentionStyle), inline: true });
      fields.push({ name: labels.target, value: formatUserValue(target, theme.mentionStyle), inline: true });

      if (theme.showDurationField && typeof durationSeconds === "number" && durationSeconds > 0) {
        fields.push({ name: labels.duration, value: formatDuration(durationSeconds), inline: true });
      }

      if (theme.showNotifiedField && typeof notified === "boolean") {
        fields.push({ name: labels.notified, value: notified ? "✅" : "❌", inline: true });
      }

      // Reason (truncate optionally)
      const finalReason = (() => {
        const txt = reason && reason.trim().length > 0 ? reason : noReason;
        if (theme.reasonMaxLength && txt.length > theme.reasonMaxLength) {
          return txt.substring(0, theme.reasonMaxLength - 1) + "…";
        }
        return txt;
      })();
      fields.push({ name: labels.reason, value: finalReason, inline: false });

      return fields as any;
    })(),
  });

  return embed;
}
