
<template>
  <div class="bg-card border border-border rounded-xl">
    <div class="p-6 border-b border-border">
      <h2 class="text-xl font-semibold text-card-foreground">Muted Members</h2>
      <p class="text-muted-foreground mt-1">Users currently muted in the server.</p>
    </div>
    <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left text-muted-foreground">
          <thead class="text-xs text-muted-foreground uppercase bg-secondary/50">
            <tr>
              <th scope="col" class="px-6 py-3">User</th>
              <th scope="col" class="px-6 py-3">Muted By</th>
              <th scope="col" class="px-6 py-3">Reason</th>
              <th scope="col" class="px-6 py-3">Expires</th>
              <th scope="col" class="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="mutedUsers.length === 0">
              <td colspan="5" class="text-center py-10 text-muted-foreground">No users are currently muted.</td>
            </tr>
            <tr
              v-else
              v-for="entry in mutedUsers"
              :key="entry.user.id"
              class="border-b border-border"
            >
              <td class="px-6 py-4 font-medium text-foreground">
                <button @click="$emit('user-selected', entry.user)" class="hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded">
                  @{{ entry.user.name }}
                </button>
              </td>
              <td class="px-6 py-4">{{ entry.moderator.name }}</td>
              <td class="px-6 py-4 max-w-xs truncate" :title="entry.reason">{{ entry.reason }}</td>
              <td class="px-6 py-4">{{ formatTimestamp(entry.mutedUntil) }}</td>
              <td class="px-6 py-4 text-right">
                <button @click="$emit('unmute-user', entry.user.id)" class="font-medium text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 hover:underline">Unmute</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MutedUser } from '@/types/moderation';
import type { AuditLogUser } from '@/types/audit-log';
import { formatDistanceToNow } from 'date-fns';

defineProps<{
  mutedUsers: MutedUser[];
}>();

defineEmits<{
  (e: 'user-selected', user: AuditLogUser): void;
  (e: 'unmute-user', userId: string): void;
}>();

const formatTimestamp = (timestamp: Date) => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};
</script>
