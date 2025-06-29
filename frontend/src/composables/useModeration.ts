import { ref, computed, watchEffect } from 'vue';
import { useToastStore } from '@/stores/toast';
import type { DiscordItem } from '@/types/discord';
import type { AuditLogEntry, AuditLogUser } from '@/types/audit-log';
import type {
	AutoModSettings as AutoModSettingsType,
	ModeratorNote,
	LeaderboardEntry,
	AutoModPunishment,
} from '@/types/moderation';
import { format } from 'date-fns';
import { useMutedUsers } from './useMutedUsers';
import { useBannedUsers } from './useBannedUsers';
import { useModerationCases } from './useModerationCases';
import { useModeratorNotes } from './useModeratorNotes';
import { useGuildsStore } from '@/stores/guilds';
import { moderationEndpoints } from '@/lib/endpoints/moderation';
import { guildsApi, rolesApi } from '@/lib/endpoints';
import { analyticsApi } from '@/lib/endpoints';

type Action = 'warn' | 'mute' | 'kick' | 'ban';
interface ActionInfo {
	action: Action;
	user: AuditLogUser;
	predefinedReasons?: string[];
}

interface DailyActivityEntry {
	date: string;
	cases: number;
}

interface ModerationAnalytics {
	dailyActivity: DailyActivityEntry[];
}

const ROLE_TTL_MS = 60000; // 1 minute

export function useModeration() {
	const toastStore = useToastStore();
	const guildStore = useGuildsStore();

	// Use smaller composables for data management
	const { mutedUsers, unmuteUser, fetchMutes } = useMutedUsers();
	const { bannedUsers, unbanUser, fetchBans } = useBannedUsers();
	const {
		moderationCases,
		selectedCase,
		openCaseModal,
		closeCaseModal,
		fetchCases,
	} = useModerationCases();
	const { moderatorNotes, fetchNotes, addNote } = useModeratorNotes();

	const fetchSettings = async () => {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await moderationEndpoints.getSettings(
				guildStore.currentGuild.id
			);
			automod.value = data.automod;
			maxMessagesCleared.value = data.maxMessagesCleared;
		} catch (error) {
			console.error('Failed to fetch moderation settings:', error);
			toastStore.addToast('Failed to load moderation settings.', 'error');
		}
	};

	const rolesCache = new Map<
		string,
		{ roles: DiscordItem[]; fetchedAt: number }
	>();

	const fetchRoles = async () => {
		if (!guildStore.currentGuild) return;

		const now = Date.now();
		const gid = guildStore.currentGuild.id;
		const cacheItem = rolesCache.get(gid);

		if (cacheItem && now - cacheItem.fetchedAt < ROLE_TTL_MS) {
			roles.value = cacheItem.roles;
			return;
		}

		try {
			const { data } = await rolesApi.rolesEndpoints.getRoles(gid);
			roles.value = data;
			rolesCache.set(gid, { roles: data, fetchedAt: now });
		} catch (e) {
			console.error('Failed to fetch roles', e);
		}
	};

	const fetchAll = async () => {
		await Promise.all([
			fetchCases(),
			fetchMutes(),
			fetchBans(),
			fetchSettings(),
			fetchRoles(),
			fetchModerationAnalytics(),
		]);
	};

	// Run when current guild becomes available or changes
	const lastFetchedGuildId = ref<string | null>(null);
	watchEffect(() => {
		const gid = guildStore.currentGuild?.id;
		if (gid && gid !== lastFetchedGuildId.value) {
			lastFetchedGuildId.value = gid;
			fetchAll();
		}
	});

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

	const automod = ref<AutoModSettingsType>({
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
		},
	});

	const roles = ref<DiscordItem[]>([]);

	// User History Modal
	const selectedUserForHistory = ref<AuditLogUser | null>(null);
	const userAuditLog = ref<AuditLogEntry[]>([]);
	const userNotes = ref<ModeratorNote[]>([]);

	const openUserHistoryModal = async (user: AuditLogUser) => {
		selectedUserForHistory.value = user;
		userAuditLog.value = moderationCases.value
			.filter((c) => c.target.type === 'user' && c.target.id === user.id)
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		await fetchNotes(user.id);
		userNotes.value = moderatorNotes.value.get(user.id) || [];
	};

	const closeUserHistoryModal = () => {
		selectedUserForHistory.value = null;
		userAuditLog.value = [];
		userNotes.value = [];
	};

	const saveChanges = async () => {
		if (!guildStore.currentGuild) return;
		try {
			await moderationEndpoints.updateSettings(guildStore.currentGuild.id, {
				automod: automod.value,
				maxMessagesCleared: maxMessagesCleared.value,
			});
			toastStore.addToast('Moderation settings saved!', 'success');
		} catch (error) {
			console.error('Failed to save moderation settings:', error);
			toastStore.addToast('Failed to save moderation settings.', 'error');
		}
	};

	// Moderation Action Modal
	const isActionModalOpen = ref(false);
	const actionInfo = ref<ActionInfo | null>(null);

	const performModerationAction = (action: Action, user: AuditLogUser) => {
		actionInfo.value = {
			action,
			user,
			predefinedReasons: predefinedReasons[action],
		};
		isActionModalOpen.value = true;
		// We no longer close the history modal here, so it stays open in the background.
	};

	const closeActionModal = () => {
		isActionModalOpen.value = false;
		actionInfo.value = null;
	};

	const confirmModerationAction = async (details: {
		reason: string;
		duration: number;
		durationUnit: 'minutes' | 'hours' | 'days';
	}) => {
		if (!actionInfo.value || !guildStore.currentGuild) return;

		const { action, user } = actionInfo.value;
		const { reason, duration, durationUnit } = details;

		let durationInSeconds = 0;
		if (duration > 0) {
			const multipliers = { minutes: 60, hours: 3600, days: 86400 };
			durationInSeconds = duration * multipliers[durationUnit];
		}

		try {
			await moderationEndpoints.createModerationCase(
				guildStore.currentGuild.id,
				{
					type: action.toUpperCase(),
					userId: user.id,
					reason,
					duration: durationInSeconds,
				}
			);

			const actionText = action.charAt(0).toUpperCase() + action.slice(1);
			toastStore.addToast(
				`${actionText} action completed for @${user.name}.`,
				'success'
			);

			// Refetch data to update UI
			await fetchAll();
		} catch (error) {
			console.error(`Failed to ${action} user:`, error);
			toastStore.addToast(`Failed to execute ${action} action.`, 'error');
		} finally {
			closeActionModal();
		}
	};

	const addModeratorNote = async ({
		userId,
		content,
	}: {
		userId: string;
		content: string;
	}) => {
		await addNote(userId, content);

		if (selectedUserForHistory.value?.id === userId) {
			userNotes.value = moderatorNotes.value.get(userId) || [];
		}
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

		moderationCases.value.forEach((c) => {
			if (c.target.type === 'user') addUser(c.target as AuditLogUser);
			addUser(c.executor);
		});
		mutedUsers.value.forEach((m) => addUser(m.user));
		bannedUsers.value.forEach((b) => addUser(b.user));

		return Array.from(usersMap.values()).sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	});

	const moderatorLeaderboardData = computed((): LeaderboardEntry[] => {
		const stats: Record<string, LeaderboardEntry> = {};

		moderationCases.value.forEach((c) => {
			const modId = c.executor.id;
			if (!stats[modId]) {
				stats[modId] = {
					user: c.executor,
					actions: { ban: 0, mute: 0, kick: 0, warn: 0, total: 0 },
				};
			}

			stats[modId].actions.total++;

			if (c.action.includes('BAN')) stats[modId].actions.ban++;
			else if (c.action.includes('MUTE')) stats[modId].actions.mute++;
			else if (c.action.includes('KICK')) stats[modId].actions.kick++;
			else if (c.action.includes('WARN')) stats[modId].actions.warn++;
		});

		return Object.values(stats).sort(
			(a, b) => b.actions.total - a.actions.total
		);
	});

	// moderation analytics for charts
	const moderationAnalytics = ref<ModerationAnalytics | null>(null);

	async function fetchModerationAnalytics() {
		if (!guildStore.currentGuild) return;
		try {
			const { data } = await analyticsApi.analyticsEndpoints.getModeration(
				guildStore.currentGuild.id,
				{ period: '7d' }
			);
			const payload =
				(data as { data?: ModerationAnalytics }).data ??
				(data as ModerationAnalytics);
			moderationAnalytics.value = payload;
		} catch (e) {
			console.error('Failed analytics', e);
		}
	}

	const modActionsChartData = computed(() => {
		if (!moderationAnalytics.value) return { labels: [], datasets: [] };
		const labels = moderationAnalytics.value.dailyActivity.map(
			(d: DailyActivityEntry) => d.date
		);
		const dataset = moderationAnalytics.value.dailyActivity.map(
			(d: DailyActivityEntry) => d.cases
		);
		return {
			labels,
			datasets: [
				{
					label: 'Cases',
					backgroundColor: '#60a5fa',
					data: dataset,
				},
			],
		};
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
		fetchRoles,
		fetchModerationAnalytics,
	};
}
