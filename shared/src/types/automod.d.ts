export interface AutoModTriggerConfig {
    maxMessages?: number;
    timeWindow?: number;
    duplicateThreshold?: number;
    capsPercent?: number;
    minLength?: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
    requireTLD?: boolean;
    blockedWords?: string[];
    wildcards?: boolean;
    ignoreCase?: boolean;
    allowOwnServer?: boolean;
    allowPartners?: string[];
    maxMentions?: number;
    maxRoleMentions?: number;
    maxEveryoneMentions?: number;
    maxEmojis?: number;
    maxCustomEmojis?: number;
    patterns?: string[];
}
export interface AutoModActionConfig {
    delete?: boolean;
    warn?: boolean;
    timeout?: number;
    kick?: boolean;
    ban?: number;
    logToChannel?: string;
    notifyStaff?: boolean;
    addRole?: string;
    removeRole?: string;
    sendDM?: boolean;
    customMessage?: string;
    replyInChannel?: boolean;
}
export interface EscalationConfig {
    enableEscalation?: boolean;
    maxWarnings?: number;
    escalationActions?: AutoModActionConfig[];
}
export interface AutoModRule {
    id: string;
    guildId: string;
    name: string;
    type: string;
    enabled: boolean;
    triggers: AutoModTriggerConfig;
    sensitivity: string;
    actions: AutoModActionConfig | string;
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
export interface AutoModTestResult {
    triggered: boolean;
    reason?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
    matchedContent?: string;
}
export type LegacyActionType = 'DELETE' | 'WARN' | 'TIMEOUT' | 'KICK' | 'LOG_ONLY';
export type AutoModRuleType = 'spam' | 'caps' | 'words' | 'links' | 'invites' | 'mentions' | 'emojis';
export type SensitivityLevel = 'LOW' | 'MEDIUM' | 'HIGH';
//# sourceMappingURL=automod.d.ts.map