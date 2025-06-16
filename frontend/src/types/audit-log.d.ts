
export interface AuditLogUser {
  id: string;
  name: string;
  avatarUrl?: string;
  joinDate?: Date;
  roles?: string[];
}

export interface AuditLogTarget {
  id: string;
  name: string;
  type: 'user' | 'role' | 'channel' | 'message' | 'server' | 'invite' | 'other';
  joinDate?: Date;
  roles?: string[];
}

export interface AuditLogEntry {
  id: string;
  executor: AuditLogUser;
  action: string;
  target: AuditLogTarget;
  reason: string | null;
  timestamp: Date;
  changes?: { key: string; from: any; to: any }[];
  source: 'DISCORD' | 'BUBBLES';
}
