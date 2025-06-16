
import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { BannedUser } from '@/types/moderation';
import type { AuditLogUser } from '@/types/audit-log';
import { subDays } from 'date-fns';

const mod1: AuditLogUser = { id: 'mod1', name: 'Moderator1', joinDate: subDays(new Date(), 365), roles: ['Moderator'] };
const mod3: AuditLogUser = { id: 'mod3', name: 'SuperMod', joinDate: subDays(new Date(), 730), roles: ['Admin'] };

export function useBannedUsers() {
  const toastStore = useToastStore();

  const bannedUsers = ref<BannedUser[]>([
    { 
      user: { id: 'user1', name: 'Troublemaker', joinDate: subDays(new Date(), 90), roles: ['Member', 'Level 5'] }, 
      reason: 'Repeatedly breaking rule #3 about spamming in general chat.',
      moderator: mod1,
      bannedUntil: null // Permanent ban
    },
    {
      user: { id: 'user6', name: 'TempBanned', joinDate: subDays(new Date(), 10), roles: ['Member'] },
      reason: 'Cooling off period.',
      moderator: mod3,
      bannedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 day ban
    }
  ]);

  const unbanUser = (userId: string) => {
    const index = bannedUsers.value.findIndex(u => u.user.id === userId);
    if (index !== -1) {
      const userName = bannedUsers.value[index].user.name;
      bannedUsers.value.splice(index, 1);
      toastStore.addToast(`User @${userName} has been unbanned.`, 'success');
    }
  };

  return { bannedUsers, unbanUser };
}
