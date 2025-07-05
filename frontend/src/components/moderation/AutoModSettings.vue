
<template>
  <div class="bg-card border border-border rounded-xl">
    <div class="p-6 border-b border-border">
      <h2 class="text-xl font-semibold text-card-foreground">Auto-Moderation</h2>
      <p class="text-muted-foreground mt-1">Automatically moderate messages and users with enhanced features.</p>
    </div>
    <div class="p-6 space-y-6">
      <!-- Block Invites -->
      <div class="flex items-center justify-between">
        <div>
          <label for="blockInvites" class="font-medium text-card-foreground">Block Discord Invites</label>
          <p class="text-sm text-muted-foreground mt-1">Delete messages containing Discord server invites.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="blockInvites" v-model="modelValue.blockInvites" class="sr-only peer">
          <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>
      
      <div class="border-t border-border !my-6"></div>

      <!-- Block Links -->
      <div>
        <div class="flex items-center justify-between">
          <div>
            <label for="blockLinks" class="font-medium text-card-foreground">Block Links</label>
            <p class="text-sm text-muted-foreground mt-1">Delete messages containing links. Trusted roles are immune.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="blockLinks" v-model="modelValue.blockLinks" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div v-if="modelValue.blockLinks" class="pl-6 pt-4 mt-4 space-y-4 border-l border-border ml-5">
            <label class="block text-sm font-medium text-muted-foreground mb-2">Immune Roles</label>
            <DiscordItemSelector
                :items="roles"
                v-model:selectedIds="modelValue.blockLinksIgnoredRoleIds"
                :multiple="true"
                placeholder="Select immune roles..."
                item-type="role"
            />
        </div>
      </div>

      <div class="border-t border-border !my-6"></div>
      
      <!-- Mass Mention -->
      <div>
        <div class="flex items-center justify-between">
          <div>
            <label for="massMention" class="font-medium text-card-foreground">Anti-Mass Mention</label>
            <p class="text-sm text-muted-foreground mt-1">Punish users who mention too many users in one message.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="massMention" v-model="modelValue.antiMassMention" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div v-if="modelValue.antiMassMention" class="pl-6 pt-4 mt-4 space-y-4 border-l border-border ml-5">
            <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Punishment Actions</label>
                <div class="space-y-2">
                  <label v-for="option in punishmentOptions" :key="option.value" class="flex items-center gap-x-3 p-2 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <input type="checkbox" :value="option.value" v-model="modelValue.antiMassMentionPunishments" class="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary">
                    <span class="text-sm text-card-foreground">{{ option.label }}</span>
                  </label>
                </div>
            </div>
            <div v-if="modelValue.antiMassMentionPunishments.includes('timeout')">
                <label class="block text-sm font-medium text-muted-foreground mb-2">Timeout Duration (minutes)</label>
                <input type="number" v-model="modelValue.antiMassMentionTimeoutDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="5">
            </div>
            <div v-if="modelValue.antiMassMentionPunishments.includes('ban')" class="space-y-2">
                <label class="block text-sm font-medium text-muted-foreground">Ban Duration</label>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <input type="number" min="0" v-model="modelValue.antiMassMentionBanDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="7">
                    <p class="text-xs text-muted-foreground mt-1">Set to 0 for a permanent ban.</p>
                  </div>
                  <div>
                    <select v-model="modelValue.antiMassMentionBanDurationUnit" :disabled="modelValue.antiMassMentionBanDuration === 0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-primary focus:border-primary">
                      <option>minutes</option>
                      <option>hours</option>
                      <option>days</option>
                    </select>
                  </div>
                </div>
            </div>
        </div>
      </div>

      <div class="border-t border-border !my-6"></div>

      <!-- Spam -->
      <div>
        <div class="flex items-center justify-between">
          <div>
            <label for="antiSpam" class="font-medium text-card-foreground">Anti-Spam</label>
            <p class="text-sm text-muted-foreground mt-1">Punish users who send too many messages in a short time.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="antiSpam" v-model="modelValue.antiSpam" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div v-if="modelValue.antiSpam" class="pl-6 pt-4 mt-4 space-y-4 border-l border-border ml-5">
            <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Punishment Actions</label>
                <div class="space-y-2">
                  <label v-for="option in punishmentOptions" :key="option.value" class="flex items-center gap-x-3 p-2 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <input type="checkbox" :value="option.value" v-model="modelValue.antiSpamPunishments" class="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary">
                    <span class="text-sm text-card-foreground">{{ option.label }}</span>
                  </label>
                </div>
            </div>
            <div v-if="modelValue.antiSpamPunishments.includes('timeout')">
                <label class="block text-sm font-medium text-muted-foreground mb-2">Timeout Duration (minutes)</label>
                <input type="number" v-model="modelValue.antiSpamTimeoutDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="2">
            </div>
             <div v-if="modelValue.antiSpamPunishments.includes('ban')" class="space-y-2">
                <label class="block text-sm font-medium text-muted-foreground">Ban Duration</label>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <input type="number" min="0" v-model="modelValue.antiSpamBanDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="1">
                    <p class="text-xs text-muted-foreground mt-1">Set to 0 for a permanent ban.</p>
                  </div>
                  <div>
                    <select v-model="modelValue.antiSpamBanDurationUnit" :disabled="modelValue.antiSpamBanDuration === 0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-primary focus:border-primary">
                      <option>minutes</option>
                      <option>hours</option>
                      <option>days</option>
                    </select>
                  </div>
                </div>
            </div>
        </div>
      </div>

      <div class="border-t border-border !my-6"></div>

      <!-- Word Filter -->
      <div>
        <div class="flex items-center justify-between">
          <div>
            <label for="wordFilter" class="font-medium text-card-foreground">Word & Phrase Filter</label>
            <p class="text-sm text-muted-foreground mt-1">Punish users for using specific words or phrases.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="wordFilter" v-model="modelValue.wordFilter.enabled" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div v-if="modelValue.wordFilter.enabled" class="pl-6 pt-4 mt-4 space-y-4 border-l border-border ml-5">
            <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Blacklisted Words & Phrases</label>
                <WordListInput v-model="modelValue.wordFilter.words" />
            </div>
            <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Punishment Actions</label>
                <div class="space-y-2">
                  <label v-for="option in punishmentOptions" :key="option.value" class="flex items-center gap-x-3 p-2 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <input type="checkbox" :value="option.value" v-model="modelValue.wordFilter.punishments" class="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary">
                    <span class="text-sm text-card-foreground">{{ option.label }}</span>
                  </label>
                </div>
            </div>
            <div v-if="modelValue.wordFilter.punishments.includes('timeout')">
                <label class="block text-sm font-medium text-muted-foreground mb-2">Timeout Duration (minutes)</label>
                <input type="number" v-model="modelValue.wordFilter.timeoutDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="10">
            </div>
            <div v-if="modelValue.wordFilter.punishments.includes('ban')" class="space-y-2">
                <label class="block text-sm font-medium text-muted-foreground">Ban Duration</label>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <input type="number" min="0" v-model="modelValue.wordFilter.banDuration" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="0">
                    <p class="text-xs text-muted-foreground mt-1">Set to 0 for a permanent ban.</p>
                  </div>
                  <div>
                    <select v-model="modelValue.wordFilter.banDurationUnit" :disabled="modelValue.wordFilter.banDuration === 0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-primary focus:border-primary">
                      <option>minutes</option>
                      <option>hours</option>
                      <option>days</option>
                    </select>
                  </div>
                </div>
            </div>
        </div>
      </div>
    </div>
    <div class="p-6 bg-secondary/50 border-t border-border rounded-b-xl flex justify-end">
      <button @click="$emit('save')" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import DiscordItemSelector from '@/components/common/DiscordItemSelector.vue';
import WordListInput from '@/components/common/WordListInput.vue';
import type { DiscordItem } from '@/types/discord';
import type { AutoModSettings } from '@/types/moderation';

defineProps<{
  modelValue: AutoModSettings;
  roles: DiscordItem[];
}>();

defineEmits<{
  (e: 'update:modelValue', value: AutoModSettings): void;
  (e: 'save'): void;
}>();

const punishmentOptions = [
  { value: 'delete', label: 'Delete Message' },
  { value: 'warn', label: 'Warn User' },
  { value: 'timeout', label: 'Timeout User' },
  { value: 'kick', label: 'Kick User' },
  { value: 'ban', label: 'Ban User' },
];
</script>
