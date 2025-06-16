
import { ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { MutedUser } from '@/types/moderation';
import type { AuditLogUser } from '@/types/audit-log';
import { subDays } from 'date-fns';

const mod1: AuditLogUser = { id: 'mod1', name: 'Moderator1', joinDate: subDays(new Date(), 365), roles: ['Moderator'] };
const mod2: AuditLogUser = { id: 'mod2', name: 'AdminBot', joinDate: subDays(new Date(), 1000), roles: ['Bot'] };

export function useMutedUsers() {
  const toastStore = useToastStore();
  
  const mutedUsers = ref<MutedUser[]>([
    { 
      user: { id: 'user2', name: 'Spammer', joinDate: subDays(new Date(), 5), roles: ['Member'] }, 
      mutedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), 
      reason: 'Auto-detected spam.',
      moderator: mod2
    },
    { 
      user: { id: 'user5', name: 'NoisyPerson', joinDate: subDays(new Date(), 200), roles: ['Member', 'Booster'] }, 
      mutedUntil: new Date(Date.now() + 1000 * 60 * 30), 
      reason: 'Excessive caps.',
      moderator: mod1
    }
  ]);

  const unmuteUser = (userId: string) => {
    const index = mutedUsers.value.findIndex(u => u.user.id === userId);
    if (index !== -1) {
      const userName = mutedUsers.value[index].user.name;
      mutedUsers.value.splice(index, 1);
      toastStore.addToast(`User @${userName} has been unmuted.`, 'success');
    }
  };

  return { mutedUsers, unmuteUser };
}
