
import type { AuditLogEntry } from '@/types/audit-log';

interface ActionDetails {
  icon: string;
  text: string;
  color: string;
}

export function getActionDetails(action: string): ActionDetails {
  if (action.includes('BAN')) return { icon: '⚖️', text: 'banned', color: 'text-red-400' };
  if (action.includes('KICK')) return { icon: '👢', text: 'kicked', color: 'text-orange-400' };
  if (action.includes('MUTE')) return { icon: '🤫', text: 'muted', color: 'text-yellow-400' };
  if (action.includes('WARN')) return { icon: '📣', text: 'warned', color: 'text-yellow-400' };
  if (action.includes('ROLE_CREATE')) return { icon: '✨', text: 'created role', color: 'text-green-400' };
  if (action.includes('ROLE_DELETE')) return { icon: '🗑️', text: 'deleted role', color: 'text-red-400' };
  if (action.includes('ROLE_UPDATE')) return { icon: '🎨', text: 'updated role', color: 'text-blue-400' };
  if (action.includes('MESSAGE_DELETE')) return { icon: '🗑️', text: 'deleted messages in', color: 'text-slate-400' };
  
  return { icon: '📋', text: action.replace(/_/g, ' ').toLowerCase(), color: 'text-slate-400' };
}

export function formatTarget(log: AuditLogEntry): string {
    switch(log.target.type) {
        case 'user':
            return `@${log.target.name}`;
        case 'channel':
            return `#${log.target.name}`;
        default:
            return log.target.name;
    }
}
