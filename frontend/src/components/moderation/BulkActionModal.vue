<template>
	<div
		v-if="isOpen"
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
	>
		<div
			class="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4"
		>
			<div class="p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-card-foreground">
						{{ getTitle() }}
					</h2>
					<button
						@click="closeModal"
						class="text-muted-foreground hover:text-foreground"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="lucide lucide-x"
						>
							<path d="m18 6-12 12" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>

				<form @submit.prevent="submitAction" class="space-y-4">
					<!-- User IDs Input -->
					<div>
						<label class="block text-sm font-medium text-card-foreground mb-2">
							User IDs (comma-separated)
						</label>
						<textarea
							v-model="userIds"
							placeholder="123456789, 987654321, ..."
							class="w-full p-3 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground resize-none"
							rows="3"
							required
						/>
						<p class="text-xs text-muted-foreground mt-1">
							Maximum {{ maxUsers }} users per operation
						</p>
					</div>

					<!-- Reason Input -->
					<div>
						<label class="block text-sm font-medium text-card-foreground mb-2">
							Reason
						</label>
						<input
							v-model="reason"
							type="text"
							placeholder="Enter reason for this action..."
							class="w-full p-3 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground"
							required
						/>
					</div>

					<!-- Duration Input (for timeout only) -->
					<div v-if="actionType === 'timeout'">
						<label class="block text-sm font-medium text-card-foreground mb-2">
							Duration
						</label>
						<div class="flex gap-2">
							<input
								v-model="duration"
								type="number"
								min="1"
								max="28"
								placeholder="1"
								class="flex-1 p-3 bg-muted border border-border rounded-lg text-card-foreground placeholder-muted-foreground"
								required
							/>
							<select
								v-model="durationUnit"
								class="p-3 bg-muted border border-border rounded-lg text-card-foreground"
							>
								<option value="minutes">Minutes</option>
								<option value="hours">Hours</option>
								<option value="days">Days</option>
							</select>
						</div>
						<p class="text-xs text-muted-foreground mt-1">Maximum 28 days</p>
					</div>

					<!-- Delete Messages Option (for ban only) -->
					<div v-if="actionType === 'ban'" class="flex items-center gap-2">
						<input
							v-model="deleteMessages"
							type="checkbox"
							id="deleteMessages"
							class="w-4 h-4 text-primary bg-muted border-border rounded focus:ring-primary"
						/>
						<label for="deleteMessages" class="text-sm text-card-foreground">
							Delete messages from these users
						</label>
					</div>

					<!-- Action Buttons -->
					<div class="flex gap-3 pt-4">
						<button
							type="button"
							@click="closeModal"
							class="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							:disabled="isSubmitting || !isValid"
							:class="[
								'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
								getSubmitButtonClass(),
								isSubmitting || !isValid ? 'opacity-50 cursor-not-allowed' : '',
							]"
						>
							{{ isSubmitting ? 'Processing...' : getSubmitText() }}
						</button>
					</div>
				</form>

				<!-- Warning -->
				<div
					class="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
				>
					<div class="flex items-start gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="lucide lucide-alert-triangle text-yellow-400 mt-0.5"
						>
							<path
								d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
							/>
							<path d="M12 9v4" />
							<circle cx="12" cy="17.5" r=".5" />
						</svg>
						<div>
							<p class="text-sm font-medium text-yellow-400">Warning</p>
							<p class="text-xs text-muted-foreground">
								This action will be applied to all specified users. Make sure
								you have the correct user IDs.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
	isOpen: boolean;
	actionType: 'ban' | 'kick' | 'timeout' | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: 'close'): void;
	(
		e: 'submit',
		data: {
			type: 'ban' | 'kick' | 'timeout';
			userIds: string[];
			reason: string;
			duration?: number;
			deleteMessages?: boolean;
		}
	): void;
}>();

// Form data
const userIds = ref('');
const reason = ref('');
const duration = ref(1);
const durationUnit = ref<'minutes' | 'hours' | 'days'>('hours');
const deleteMessages = ref(false);
const isSubmitting = ref(false);

// Constants
const maxUsers = 100;

// Computed properties
const isValid = computed(() => {
	const userIdList = userIds.value
		.split(/[,\s]+/)
		.filter((id) => id.trim().length > 0);
	return (
		userIdList.length > 0 &&
		userIdList.length <= maxUsers &&
		reason.value.trim().length > 0
	);
});

// Methods
const getTitle = () => {
	const titles = {
		ban: 'Bulk Ban Users',
		kick: 'Bulk Kick Users',
		timeout: 'Bulk Timeout Users',
	};
	return props.actionType ? titles[props.actionType] : 'Bulk Action';
};

const getSubmitText = () => {
	const texts = {
		ban: 'Ban Users',
		kick: 'Kick Users',
		timeout: 'Timeout Users',
	};
	return props.actionType ? texts[props.actionType] : 'Execute';
};

const getSubmitButtonClass = () => {
	const classes = {
		ban: 'bg-red-500 hover:bg-red-600 text-white',
		kick: 'bg-orange-500 hover:bg-orange-600 text-white',
		timeout: 'bg-yellow-500 hover:bg-yellow-600 text-white',
	};
	return props.actionType
		? classes[props.actionType]
		: 'bg-primary hover:bg-primary/90 text-primary-foreground';
};

const closeModal = () => {
	// Reset form
	userIds.value = '';
	reason.value = '';
	duration.value = 1;
	durationUnit.value = 'hours';
	deleteMessages.value = false;
	isSubmitting.value = false;

	emit('close');
};

const submitAction = async () => {
	if (!props.actionType || !isValid.value || isSubmitting.value) return;

	isSubmitting.value = true;

	try {
		const userIdList = userIds.value
			.split(/[,\s]+/)
			.filter((id) => id.trim().length > 0);

		let finalDuration: number | undefined;
		if (props.actionType === 'timeout') {
			const multipliers = { minutes: 60, hours: 3600, days: 86400 };
			finalDuration = duration.value * multipliers[durationUnit.value];
		}

		emit('submit', {
			type: props.actionType,
			userIds: userIdList,
			reason: reason.value.trim(),
			duration: finalDuration,
			deleteMessages:
				props.actionType === 'ban' ? deleteMessages.value : undefined,
		});

		closeModal();
	} catch (error) {
		console.error('Error submitting bulk action:', error);
	} finally {
		isSubmitting.value = false;
	}
};
</script>
