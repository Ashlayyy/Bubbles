import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useGuildsStore } from './guilds';
import { customCommandsEndpoints } from '@/lib/endpoints/customCommands';

export interface CustomCommand {
	id: string;
	name: string;
	description: string;
	content: string;
	aliases: string[];
	enabled: boolean;
	embedEnabled: boolean;
	embedTitle?: string;
	embedColor?: string;
	embedDescription?: string;
	embedFooter?: string;
	embedThumbnail?: string;
	embedImage?: string;
	permissions: string[];
	channels: string[];
	roles: string[];
	cooldown: number;
	deleteInvoke: boolean;
	createdAt: string;
	updatedAt: string;
	usageCount: number;
}

export const useCommandsStore = defineStore('commands', () => {
	const commands = ref<CustomCommand[]>([]);
	const guildStore = useGuildsStore();

	const fetchCommands = async () => {
		if (!guildStore.currentGuild) {
			commands.value = [];
			return;
		}
		try {
			const { data } = await customCommandsEndpoints.getCommands(
				guildStore.currentGuild.id
			);
			commands.value = data;
		} catch (error) {
			console.error('Failed to fetch custom commands:', error);
			commands.value = [];
		}
	};

	watch(() => guildStore.currentGuild, fetchCommands, { immediate: true });

	const searchQuery = ref('');
	const selectedStatus = ref<'all' | 'enabled' | 'disabled'>('all');

	const filteredCommands = computed(() => {
		return commands.value.filter((command) => {
			const matchesSearch =
				command.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
				command.description
					.toLowerCase()
					.includes(searchQuery.value.toLowerCase()) ||
				command.aliases.some((alias) =>
					alias.toLowerCase().includes(searchQuery.value.toLowerCase())
				);

			const matchesStatus =
				selectedStatus.value === 'all' ||
				(selectedStatus.value === 'enabled' && command.enabled) ||
				(selectedStatus.value === 'disabled' && !command.enabled);

			return matchesSearch && matchesStatus;
		});
	});

	const addCommand = async (
		command: Omit<
			CustomCommand,
			'id' | 'createdAt' | 'updatedAt' | 'usageCount'
		>
	) => {
		if (!guildStore.currentGuild) return;
		try {
			await customCommandsEndpoints.createCommand(
				guildStore.currentGuild.id,
				command
			);
			await fetchCommands();
		} catch (error) {
			console.error('Failed to add custom command:', error);
			// Optionally show a toast notification
		}
	};

	const updateCommand = async (id: string, updates: Partial<CustomCommand>) => {
		if (!guildStore.currentGuild) return;
		try {
			await customCommandsEndpoints.updateCommand(
				guildStore.currentGuild.id,
				id,
				updates
			);
			await fetchCommands();
		} catch (error) {
			console.error('Failed to update custom command:', error);
		}
	};

	const deleteCommand = async (id: string) => {
		if (!guildStore.currentGuild) return;
		try {
			await customCommandsEndpoints.deleteCommand(
				guildStore.currentGuild.id,
				id
			);
			await fetchCommands();
		} catch (error) {
			console.error('Failed to delete custom command:', error);
		}
	};

	const toggleCommand = async (id: string) => {
		const command = commands.value.find((cmd) => cmd.id === id);
		if (command) {
			await updateCommand(id, { enabled: !command.enabled });
		}
	};

	return {
		commands,
		searchQuery,
		selectedStatus,
		filteredCommands,
		addCommand,
		updateCommand,
		deleteCommand,
		toggleCommand,
	};
});
