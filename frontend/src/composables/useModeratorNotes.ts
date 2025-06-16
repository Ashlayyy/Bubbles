
import { ref } from 'vue';
import type { ModeratorNote } from '@/types/moderation';
import type { AuditLogUser } from '@/types/audit-log';
import { subDays } from 'date-fns';

const mod1: AuditLogUser = { id: 'mod1', name: 'Moderator1', joinDate: subDays(new Date(), 365), roles: ['Moderator'] };
const mod3: AuditLogUser = { id: 'mod3', name: 'SuperMod', joinDate: subDays(new Date(), 730), roles: ['Admin'] };

export function useModeratorNotes() {
  const moderatorNotes = ref<Map<string, ModeratorNote[]>>(new Map([
    ['user1', [
      { id: 'note1', moderator: mod1, content: 'Seems to be deliberately trying to annoy other users.', timestamp: subDays(new Date(), 5) },
      { id: 'note2', moderator: mod3, content: 'User was warned in DMs about behavior.', timestamp: subDays(new Date(), 3) },
    ]]
  ]));

  return { moderatorNotes };
}
