
<template>
  <div class="bg-card border border-border rounded-xl">
    <div class="p-6 border-b border-border">
      <h2 class="text-xl font-semibold text-card-foreground">Moderator Leaderboard</h2>
      <p class="text-muted-foreground mt-1">Activity of all moderators based on actions taken.</p>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left text-muted-foreground">
        <thead class="text-xs text-muted-foreground uppercase bg-secondary/50">
          <tr>
            <th scope="col" class="px-6 py-3">Moderator</th>
            <th scope="col" class="px-6 py-3 text-center">Bans</th>
            <th scope="col" class="px-6 py-3 text-center">Mutes</th>
            <th scope="col" class="px-6 py-3 text-center">Kicks</th>
            <th scope="col" class="px-6 py-3 text-center">Warnings</th>
            <th scope="col" class="px-6 py-3 text-center">Total Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="leaderboardData.length === 0">
            <td colspan="6" class="text-center py-10 text-muted-foreground">No moderator activity found.</td>
          </tr>
          <tr v-for="mod in leaderboardData" :key="mod.user.id" class="border-b border-border hover:bg-secondary/20">
            <td class="px-6 py-4 font-medium text-foreground">
              <a href="#" @click.prevent="$emit('user-selected', mod.user)" class="hover:underline flex items-center gap-2">
                <span>@{{ mod.user.name }}</span>
              </a>
            </td>
            <td class="px-6 py-4 text-center">{{ mod.actions.ban }}</td>
            <td class="px-6 py-4 text-center">{{ mod.actions.mute }}</td>
            <td class="px-6 py-4 text-center">{{ mod.actions.kick }}</td>
            <td class="px-6 py-4 text-center">{{ mod.actions.warn }}</td>
            <td class="px-6 py-4 text-center font-bold text-foreground">{{ mod.actions.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditLogUser } from '@/types/audit-log';
import type { LeaderboardEntry } from '@/types/moderation';

defineProps<{
  leaderboardData: LeaderboardEntry[];
}>();

defineEmits<{
  (e: 'user-selected', user: AuditLogUser): void;
}>();
</script>
