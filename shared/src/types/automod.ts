// Auto-moderation shared types
export interface AutoModTriggerConfig {
  // Spam detection
  maxMessages?: number;
  timeWindow?: number; // seconds
  duplicateThreshold?: number;

  // Caps detection
  capsPercent?: number;
  minLength?: number;

  // Link detection
  allowedDomains?: string[];
  blockedDomains?: string[];
  requireTLD?: boolean;

  // Word filter
  blockedWords?: string[];
  wildcards?: boolean;
  ignoreCase?: boolean;

  // Invite detection
  allowOwnServer?: boolean;
  allowPartners?: string[]; // Partner server IDs

  // Mention spam
  maxMentions?: number;
  maxRoleMentions?: number;
  maxEveryoneMentions?: number;

  // Emoji spam
  maxEmojis?: number;
  maxCustomEmojis?: number;

  // Other patterns
  patterns?: string[]; // Custom regex patterns
}

export interface AutoModActionConfig {
  // Primary actions
  delete?: boolean;
  warn?: boolean;
  timeout?: number; // Duration in seconds
  kick?: boolean;
  ban?: number; // Duration in seconds, 0 = permanent

  // Additional actions
  logToChannel?: string;
  notifyStaff?: boolean;
  addRole?: string; // Mute role ID
  removeRole?: string;

  // Message actions
  sendDM?: boolean;
  customMessage?: string;
  replyInChannel?: boolean;
}

export interface EscalationConfig {
  enableEscalation?: boolean;
  maxWarnings?: number;
  escalationActions?: AutoModActionConfig[];
}

// Database-compatible types
export interface AutoModRule {
  id: string;
  guildId: string;
  name: string;
  type: string;
  enabled: boolean;
  triggers: AutoModTriggerConfig;
  sensitivity: string;
  actions: AutoModActionConfig | string; // Support both new and legacy formats
  escalation?: EscalationConfig;
  exemptRoles: string[];
  exemptChannels: string[];
  exemptUsers: string[];
  targetChannels: string[];
  logChannel?: string;
  logActions: boolean;
  triggerCount: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Service result types
export interface AutoModTestResult {
  triggered: boolean;
  reason?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  matchedContent?: string;
}

// Legacy action types for backward compatibility
export type LegacyActionType = 'DELETE' | 'WARN' | 'TIMEOUT' | 'KICK' | 'LOG_ONLY';

// Rule types
export type AutoModRuleType = 'spam' | 'caps' | 'words' | 'links' | 'invites' | 'mentions' | 'emojis';

// Sensitivity levels
export type SensitivityLevel = 'LOW' | 'MEDIUM' | 'HIGH'; 