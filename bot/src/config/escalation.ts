export interface EscalationRule {
  pointThreshold: number;
  action: "TIMEOUT" | "BAN" | "ROLE_REMOVE" | "ROLE_ADD";
  duration?: number; // seconds
  severity: "AUTO_ESCALATION";
  roleId?: string; // for role actions
  reason?: string;
}

export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    pointThreshold: 5,
    action: "TIMEOUT",
    duration: 3600, // 1 hour
    severity: "AUTO_ESCALATION",
    reason: "Auto-escalation: 5 infraction points reached",
  },
  {
    pointThreshold: 10,
    action: "TIMEOUT",
    duration: 43200, // 12 hours
    severity: "AUTO_ESCALATION",
    reason: "Auto-escalation: 10 infraction points reached",
  },
  {
    pointThreshold: 15,
    action: "BAN",
    duration: 604800, // 7 days
    severity: "AUTO_ESCALATION",
    reason: "Auto-escalation: 15 infraction points reached",
  },
  {
    pointThreshold: 25,
    action: "BAN",
    severity: "AUTO_ESCALATION",
    reason: "Auto-escalation: 25 infraction points reached (permanent)",
  },
];

export const ESCALATION_CONFIG = {
  // Enable/disable auto-escalation system
  ENABLED: process.env.AUTO_ESCALATION_ENABLED !== "false",

  // Escalation settings
  RULES: DEFAULT_ESCALATION_RULES,

  // Point decay settings
  POINT_DECAY_ENABLED: process.env.POINT_DECAY_ENABLED !== "false",
  POINT_DECAY_DAYS: parseInt(process.env.POINT_DECAY_DAYS ?? "30"), // 30 days
  POINT_DECAY_AMOUNT: parseInt(process.env.POINT_DECAY_AMOUNT ?? "1"), // 1 point per period

  // Grace period (prevent immediate escalation after joining)
  GRACE_PERIOD_HOURS: parseInt(process.env.ESCALATION_GRACE_PERIOD ?? "24"), // 24 hours

  // Notification settings
  NOTIFY_STAFF_CHANNEL: process.env.ESCALATION_NOTIFY_CHANNEL,
  NOTIFY_ON_ESCALATION: process.env.NOTIFY_ESCALATION !== "false",
} as const;

export type EscalationConfig = typeof ESCALATION_CONFIG;
