
<template>
  <div class="bg-slate-900 border border-slate-800 rounded-xl">
    <div class="p-6 border-b border-slate-800">
      <h2 class="text-xl font-semibold text-white">Level Up Message</h2>
      <p class="text-slate-400 mt-1">Notify users when they reach a new level.</p>
    </div>
    <div class="p-6 space-y-6">
        <div class="flex items-start justify-between">
        <div>
          <label for="levelUpMessageEnabled" class="font-medium text-white">Enable Level Up Messages</label>
          <p class="text-sm text-slate-400 mt-1">Send a message when a user levels up.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="levelUpMessageEnabled" :checked="levelUpMessageEnabled" @change="$emit('update:levelUpMessageEnabled', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div class="border-t border-slate-800 !my-6"></div>

      <div :class="{ 'opacity-50 pointer-events-none': !levelUpMessageEnabled || !levelingEnabled }">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Message Destination</label>
          <div class="flex space-x-4">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="radio" :checked="levelUpMessageDestination === 'current'" @change="$emit('update:levelUpMessageDestination', 'current')" value="current" name="destination" class="form-radio bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500">
              <span class="text-slate-200">Current Channel</span>
            </label>
              <label class="flex items-center space-x-2 cursor-pointer">
              <input type="radio" :checked="levelUpMessageDestination === 'specific'" @change="$emit('update:levelUpMessageDestination', 'specific')" value="specific" name="destination" class="form-radio bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500">
              <span class="text-slate-200">Specific Channel</span>
            </label>
          </div>
        </div>

        <div v-if="levelUpMessageDestination === 'specific'" class="mt-4">
          <label for="levelUpChannel" class="block text-sm font-medium text-slate-300 mb-2">Notification Channel</label>
          <input type="text" id="levelUpChannel" :value="levelUpChannelId" @input="$emit('update:levelUpChannelId', ($event.target as HTMLInputElement).value)" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Enter Channel ID or select channel">
          <p class="mt-2 text-xs text-slate-500">This will be replaced with a channel selector.</p>
        </div>

        <div class="mt-4">
          <label for="levelUpMessage" class="block text-sm font-medium text-slate-300 mb-2">Message Content</label>
          <textarea id="levelUpMessage" :value="levelUpMessage" @input="$emit('update:levelUpMessage', ($event.target as HTMLInputElement).value)" rows="4" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. GG {user}, you reached level {level}!"></textarea>
          <p class="mt-2 text-xs text-slate-500">Variables: <code class="bg-slate-700 px-1 py-0.5 rounded">{user}</code> <code class="bg-slate-700 px-1 py-0.5 rounded">{level}</code></p>
        </div>
      </div>
    </div>
    <div class="p-6 bg-slate-900/50 border-t border-slate-800 rounded-b-xl flex justify-end">
      <button @click="saveChanges" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/toast';

defineProps<{
  levelingEnabled: boolean;
  levelUpMessageEnabled: boolean;
  levelUpMessageDestination: string;
  levelUpChannelId: string;
  levelUpMessage: string;
}>();

defineEmits<{
  (e: 'update:levelUpMessageEnabled', value: boolean): void;
  (e: 'update:levelUpMessageDestination', value: string): void;
  (e: 'update:levelUpChannelId', value: string): void;
  (e: 'update:levelUpMessage', value: string): void;
}>();

const toastStore = useToastStore();

const saveChanges = () => {
  toastStore.addToast('Level up message settings saved successfully!', 'success');
};
</script>
