
<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-8">Auto Roles</h1>
    
    <div class="bg-card border border-border rounded-xl max-w-4xl">
      <div class="p-6 border-b border-border">
        <h2 class="text-xl font-semibold text-foreground">Auto Role Settings</h2>
        <p class="text-muted-foreground mt-1">Automatically assign roles to new members when they join.</p>
      </div>
      
      <div class="p-6 space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <label for="autoroleEnabled" class="font-medium text-foreground">Enable Auto Roles</label>
            <p class="text-sm text-muted-foreground mt-1">Assign roles to new members automatically.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="autoroleEnabled" v-model="autoroleEnabled" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div class="border-t border-border !my-6"></div>

        <div class="space-y-6" :class="{ 'opacity-50 pointer-events-none': !autoroleEnabled }">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Roles to Assign</label>
            <DiscordItemSelector
              :items="allRoles"
              :selected-ids="assignedRoles"
              @update:selected-ids="assignedRoles = $event"
              :multiple="true"
              item-type="role"
              placeholder="Select roles to assign"
            />
             <p v-if="!delayEnabled" class="mt-2 text-xs text-muted-foreground">These roles will be given to users as soon as they join the server.</p>
             <p v-else class="mt-2 text-xs text-muted-foreground">These roles will be given to users after the configured delay.</p>
          </div>

          <div class="border-t border-border !my-6"></div>

          <!-- Delayed Roles -->
          <div class="flex items-start justify-between">
            <div>
              <label for="delayEnabled" class="font-medium text-foreground">Delayed Roles</label>
              <p class="text-sm text-muted-foreground mt-1">Assign roles after a member is in the server for a set time.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="delayEnabled" v-model="delayEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div :class="{ 'opacity-50 pointer-events-none': !delayEnabled }">
            <label class="block text-sm font-medium text-foreground mb-2">Wait Time</label>
            <div class="flex space-x-2">
              <input type="number" v-model.number="delayTime" class="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary" placeholder="10">
              <select v-model="delayUnit" class="bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:ring-primary focus:border-primary">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
             <p class="mt-2 text-xs text-muted-foreground">The time a user must be in the server before receiving roles.</p>
          </div>
          
          <div class="border-t border-border !my-6"></div>
          
          <!-- Role Persistence -->
          <div class="flex items-start justify-between">
            <div>
              <label for="rolePersistenceEnabled" class="font-medium text-foreground">Role Persistence</label>
              <p class="text-sm text-muted-foreground mt-1">Re-assign roles to members who leave and rejoin.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="rolePersistenceEnabled" v-model="rolePersistenceEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="border-t border-border !my-6"></div>
          
          <!-- Ignore Bots -->
          <div class="flex items-start justify-between">
            <div>
              <label for="ignoreBotsEnabled" class="font-medium text-foreground">Ignore Bots</label>
              <p class="text-sm text-muted-foreground mt-1">Prevent bots from receiving roles automatically.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="ignoreBotsEnabled" v-model="ignoreBotsEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
      
      <div class="p-6 bg-card/50 border-t border-border rounded-b-xl flex justify-end">
        <button @click="saveChanges" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DiscordItemSelector from '@/components/common/DiscordItemSelector.vue';
import type { DiscordItem } from '@/types/discord';
import { guildsApi } from '@/lib/endpoints';
import { welcomeEndpoints } from '@/lib/endpoints/welcome';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const toast = useToastStore();
const guildId = () => route.params.guildId as string;

const autoroleEnabled = ref(false);
const allRoles = ref<DiscordItem[]>([]);
const assignedRoles = ref<string[]>([]);
const delayEnabled = ref(false);
const delayTime = ref(10);
const delayUnit = ref<'minutes' | 'hours' | 'days'>('minutes');
const rolePersistenceEnabled = ref(false);
const ignoreBotsEnabled = ref(true);

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

onMounted(async () => {
  try {
    const [rolesRes, welcomeRes] = await Promise.all([
      guildsApi.getGuildRoles(guildId()),
      welcomeEndpoints.getSettings(guildId()),
    ]);
    const roles = unwrap<Array<{ id: string; name: string }>>(rolesRes);
    allRoles.value = (Array.isArray(roles) ? roles : []).map((role) => ({
      id: role.id,
      name: role.name,
    }));
    const welcome = unwrap<{ welcome?: { roles?: string[]; enabled?: boolean }; extra?: Record<string, unknown> }>(
      welcomeRes.data ?? welcomeRes
    );
    assignedRoles.value = welcome.welcome?.roles ?? [];
    autoroleEnabled.value = assignedRoles.value.length > 0;
  } catch {
    toast.addToast('Failed to load autorole settings', 'error');
  }
});

async function saveChanges() {
  try {
    await welcomeEndpoints.updateSettings(guildId(), {
      welcome: {
        roles: autoroleEnabled.value ? assignedRoles.value : [],
      },
    });
    await guildsApi.updateGuildSettings(guildId(), {
      config: {
        welcomeStats: {
          delayEnabled: delayEnabled.value,
          delayTime: delayTime.value,
          delayUnit: delayUnit.value,
          persistRoles: rolePersistenceEnabled.value,
          ignoreBots: ignoreBotsEnabled.value,
        },
      },
    });
    toast.addToast('Autorole settings saved', 'success');
  } catch {
    toast.addToast('Failed to save autorole settings', 'error');
  }
}
</script>
