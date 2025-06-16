import { ref, reactive, computed } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { DiscordItem } from '@/types/discord';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import type { AutoModSettings as AutoModSettingsType, ModeratorNote, LeaderboardEntry, AutoModPunishment } from '@/types/moderation';
import { subDays, format, add } from 'date-fns';
import { useMutedUsers } from './useMutedUsers';
import { useBannedUsers } from './useBannedUsers';
import { useModerationCases } from './useModerationCases';
import { useModeratorNotes } from './useModeratorNotes';

type Action = 'warn' | 'mute' | 'kick' | 'ban';
interface ActionInfo {
  action: Action;
  user: AuditLogUser;
  predefinedReasons?: string[];
}

export function useModeration() {
  const toastStore = useToastStore();
  
  // Use smaller composables for data management
  const { mutedUsers, unmuteUser } = useMutedUsers();
  const { bannedUsers, unbanUser } = useBannedUsers();
  const { moderationCases, selectedCase, openCaseModal, closeCaseModal } = useModerationCases();
  const { moderatorNotes } = useModeratorNotes();

  const predefinedReasons: Record<Action, string[]> = {
    warn: [
      'Minor spamming',
      'Inappropriate language in non-NSFW channel',
      'Disrespect towards another member',
    ],
    mute: [
      'Repeated spamming after warning',
      'Voice channel disruption',
      'Ignoring moderator instructions',
    ],
    kick: [
      'Consistent rule-breaking after multiple warnings',
      'Posting harmful links',
    ],
    ban: [
      'Posting NSFW content outside of designated channels',
      'Harassment or hate speech',
      'Threats towards other members',
      'Using a compromised or automated account',
    ],
  };

  const maxMessagesCleared = ref(100);

  const automod = reactive<AutoModSettingsType>({
    blockInvites: true,
    blockLinks: false,
    blockLinksIgnoredRoleIds: [],
    antiMassMention: true,
    antiMassMentionPunishments: ['warn'],
    antiMassMentionTimeoutDuration: 5,
    antiMassMentionBanDuration: 7,
    antiMassMentionBanDurationUnit: 'days',
    antiSpam: false,
    antiSpamPunishments: ['timeout'],
    antiSpamTimeoutDuration: 2,
    antiSpamBanDuration: 1,
    antiSpamBanDurationUnit: 'days',
    wordFilter: {
      enabled: false,
      words: ['badword1', 'badword2'],
      punishments: ['delete'],
      timeoutDuration: 10,
      banDuration: 0,
      banDurationUnit: 'days',
    }
  });

  const roles = ref<DiscordItem[]>([
    { id: '1001', name: 'Admin' },
    { id: '1002', name: 'Moderator' },
    { id: '1003', name: 'Member' },
    { id: '1004', name: 'VIP' },
    { id: '1005', name: 'Booster' },
    { id: '1006', name: 'Level 10+' },
  ]);
  
  const mod1: AuditLogUser = { id: 'mod1', name: 'Moderator1', joinDate: subDays(new Date(), 365), roles: ['Moderator'] };

  // User History Modal
  const selectedUserForHistory = ref<AuditLogUser | null>(null);
  const userAuditLog = ref<AuditLogEntry[]>([]);
  const userNotes = ref<ModeratorNote[]>([]);

  const openUserHistoryModal = (user: AuditLogUser) => {
    selectedUserForHistory.value = user;
    userAuditLog.value = moderationCases.value.filter(
      c => c.target.type === 'user' && c.target.id === user.id
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    userNotes.value = moderatorNotes.value.get(user.id) || [];
  };

  const closeUserHistoryModal = () => {
    selectedUserForHistory.value = null;
    userAuditLog.value = [];
    userNotes.value = [];
  };

  const saveChanges = () => {
    console.log('Saving settings:', {
      maxMessagesCleared: maxMessagesCleared.value,
      automod: automod,
    });
    toastStore.addToast('Moderation settings saved!', 'success');
  };

  // Moderation Action Modal
  const isActionModalOpen = ref(false);
  const actionInfo = ref<ActionInfo | null>(null);

  const performModerationAction = (action: Action, user: AuditLogUser) => {
    actionInfo.value = { action, user, predefinedReasons: predefinedReasons[action] };
    isActionModalOpen.value = true;
    // We no longer close the history modal here, so it stays open in the background.
  };

  const closeActionModal = () => {
    isActionModalOpen.value = false;
    actionInfo.value = null;
  }

  const confirmModerationAction = (details: { reason: string; duration: number; durationUnit: 'minutes' | 'hours' | 'days' }) => {
    if (!actionInfo.value) return;

    const { action, user } = actionInfo.value;
    const { reason, duration, durationUnit } = details;
    const actionText = action.charAt(0).toUpperCase() + action.slice(1);
    
    console.log(`${actionText}ing user ${user.name} for reason: ${reason}`);

    let expires: Date | null = null;
    if ((action === 'mute' || action === 'ban') && duration > 0) {
      expires = add(new Date(), { [durationUnit]: duration });
    }

    if (action === 'mute') {
      mutedUsers.value.push({
        user,
        reason,
        moderator: mod1, // Assuming current moderator is mod1
        mutedUntil: expires!,
      });
    } else if (action === 'ban') {
      bannedUsers.value.push({
        user,
        reason,
        moderator: mod1,
        bannedUntil: expires, // This correctly handles permanent bans when duration is 0
      });
    }

    moderationCases.value.unshift({
      id: `case${moderationCases.value.length + 1}`,
      executor: mod1,
      action: `USER_${action.toUpperCase()}`,
      target: { ...user, type: 'user' },
      reason,
      timestamp: new Date(),
      source: 'BUBBLES'
    });

    // Refresh user history if the modal is open
    if (selectedUserForHistory.value) {
      userAuditLog.value = moderationCases.value.filter(
        c => c.target.type === 'user' && c.target.id === selectedUserForHistory.value!.id
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    
    toastStore.addToast(`${actionText} action completed for @${user.name}.`, 'success');
    closeActionModal();
  };

  const addModeratorNote = ({ userId, content }: { userId: string, content: string }) => {
    const notes = moderatorNotes.value.get(userId) || [];
    const newNote: ModeratorNote = {
      id: `note${Math.random()}`,
      moderator: mod1, // Assuming current moderator
      content,
      timestamp: new Date(),
    };
    notes.push(newNote);
    moderatorNotes.value.set(userId, notes);
    
    if(selectedUserForHistory.value?.id === userId) {
      userNotes.value = [...notes];
    }
    
    toastStore.addToast(`Private note added for @${selectedUserForHistory.value?.name}.`, 'info');
  };

  // Computed properties for stats and combined data
  const moderationStats = computed(() => ({
    totalCases: moderationCases.value.length,
    mutedUsers: mutedUsers.value.length,
    bannedUsers: bannedUsers.value.length,
  }));

  const allUsers = computed(() => {
    const usersMap = new Map<string, AuditLogUser>();
    
    const addUser = (user: AuditLogUser) => {
      if (!usersMap.has(user.id)) {
        usersMap.set(user.id, user);
      }
    };

    moderationCases.value.forEach(c => {
      if (c.target.type === 'user') addUser(c.target as AuditLogUser);
      addUser(c.executor);
    });
    mutedUsers.value.forEach(m => addUser(m.user));
    bannedUsers.value.forEach(b => addUser(b.user));

    return Array.from(usersMap.values()).sort((a,b) => a.name.localeCompare(b.name));
  });

  const moderatorLeaderboardData = computed((): LeaderboardEntry[] => {
    const stats: Record<string, LeaderboardEntry> = {};

    moderationCases.value.forEach(c => {
      const modId = c.executor.id;
      if (!stats[modId]) {
        stats[modId] = {
          user: c.executor,
          actions: { ban: 0, mute: 0, kick: 0, warn: 0, total: 0 }
        };
      }
      
      stats[modId].actions.total++;

      if (c.action.includes('BAN')) stats[modId].actions.ban++;
      else if (c.action.includes('MUTE')) stats[modId].actions.mute++;
      else if (c.action.includes('KICK')) stats[modId].actions.kick++;
      else if (c.action.includes('WARN')) stats[modId].actions.warn++;
    });

    return Object.values(stats).sort((a, b) => b.actions.total - a.actions.total);
  });

  const modActionsChartData = computed(() => {
    const labels = Array.from({ length: 7 }).map((_, i) => format(subDays(new Date(), 6 - i), 'MMM d'));
    const data = { bans: [0,0,0,0,0,0,0], mutes: [0,0,0,0,0,0,0], kicks: [0,0,0,0,0,0,0], warns: [0,0,0,0,0,0,0] };

    data.bans = [1, 0, 2, 1, 0, 1, 0];
    data.mutes = [2, 3, 1, 4, 2, 5, 3];
    data.kicks = [0, 1, 0, 0, 2, 0, 1];
    data.warns = [5, 4, 6, 3, 7, 5, 8];

    return {
      labels,
      datasets: [
        { label: 'Bans', backgroundColor: '#f87171', data: data.bans, stack: 'actions' },
        { label: 'Mutes', backgroundColor: '#facc15', data: data.mutes, stack: 'actions' },
        { label: 'Kicks', backgroundColor: '#fb923c', data: data.kicks, stack: 'actions' },
        { label: 'Warns', backgroundColor: '#60a5fa', data: data.warns, stack: 'actions' },
      ]
    }
  });

  return {
    maxMessagesCleared,
    automod,
    roles,
    mutedUsers,
    bannedUsers,
    moderationCases,
    allUsers, // For the new Users tab
    selectedCase,
    openCaseModal,
    closeCaseModal,
    selectedUserForHistory,
    userAuditLog,
    userNotes,
    openUserHistoryModal,
    closeUserHistoryModal,
    saveChanges,
    unmuteUser,
    unbanUser,
    performModerationAction,
    moderationStats,
    moderatorLeaderboardData,
    modActionsChartData,
    isActionModalOpen,
    actionInfo,
    closeActionModal,
    confirmModerationAction,
    addModeratorNote,
  };
}
