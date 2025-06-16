
import { ref } from 'vue';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import { subDays } from 'date-fns';

const mod1: AuditLogUser = { id: 'mod1', name: 'Moderator1', joinDate: subDays(new Date(), 365), roles: ['Moderator'] };
const mod2: AuditLogUser = { id: 'mod2', name: 'AdminBot', joinDate: subDays(new Date(), 1000), roles: ['Bot'] };
const mod3: AuditLogUser = { id: 'mod3', name: 'SuperMod', joinDate: subDays(new Date(), 730), roles: ['Admin'] };

export function useModerationCases() {
  const moderationCases = ref<AuditLogEntry[]>([
    {
      id: 'case1',
      executor: mod1,
      action: 'USER_BAN',
      target: { id: 'user1', name: 'Troublemaker', type: 'user', joinDate: subDays(new Date(), 90), roles: ['Member', 'Level 5'] },
      reason: 'Repeatedly breaking rule #3 about spamming in general chat. This is a very long reason to test the truncation of the text in the table cell.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      source: 'BUBBLES'
    },
    {
      id: 'case2',
      executor: mod2,
      action: 'USER_MUTE',
      target: { id: 'user2', name: 'Spammer', type: 'user', joinDate: subDays(new Date(), 5), roles: ['Member'] },
      reason: 'Auto-detected spam.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      source: 'BUBBLES'
    },
    {
      id: 'case3',
      executor: mod1,
      action: 'USER_WARN',
      target: { id: 'user3', name: 'Newbie', type: 'user', joinDate: subDays(new Date(), 2), roles: ['Member'] },
      reason: null,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      source: 'BUBBLES'
    },
    {
      id: 'case4',
      executor: mod3,
      action: 'USER_KICK',
      target: { id: 'user4', name: 'RuleBreaker', type: 'user', joinDate: subDays(new Date(), 45), roles: ['Member', 'VIP'] },
      reason: 'Ignoring warnings.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      source: 'BUBBLES'
    }
  ]);

  const selectedCase = ref<AuditLogEntry | null>(null);

  const openCaseModal = (caseEntry: AuditLogEntry) => {
    selectedCase.value = caseEntry;
  };

  const closeCaseModal = () => {
    selectedCase.value = null;
  };

  return { moderationCases, selectedCase, openCaseModal, closeCaseModal };
}
