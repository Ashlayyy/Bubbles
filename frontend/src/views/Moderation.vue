
<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold text-foreground mb-6">Moderation</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'users'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'users'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Users
        </button>
        <button
          @click="activeTab = 'cases'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'cases'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Cases
        </button>
        <button
          @click="activeTab = 'leaderboard'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'leaderboard'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Leaderboard
        </button>
        <button
          @click="activeTab = 'muted'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'muted'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Muted
        </button>
        <button
          @click="activeTab = 'banned'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'banned'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Banned
        </button>
         <button
          @click="activeTab = 'automod'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'automod'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Auto-Moderation
        </button>
        <button
          @click="activeTab = 'general'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          General
        </button>
      </nav>
    </div>

    <div class="max-w-4xl space-y-8">
      <ModerationOverview v-if="activeTab === 'overview'" :stats="moderationStats" :mod-actions-chart-data="modActionsChartData" />
      <Users v-if="activeTab === 'users'" :users="allUsers" @user-selected="openUserHistoryModal" />
      <ModerationCases v-if="activeTab === 'cases'" :cases="moderationCases" @case-selected="openCaseModal" @user-selected="openUserHistoryModal" />
      <ModeratorLeaderboard v-if="activeTab === 'leaderboard'" :leaderboard-data="moderatorLeaderboardData" @user-selected="openUserHistoryModal" />
      <MutedMembers v-if="activeTab === 'muted'" :muted-users="mutedUsers" @user-selected="openUserHistoryModal" @unmute-user="unmuteUser" />
      <BannedMembers v-if="activeTab === 'banned'" :banned-users="bannedUsers" @user-selected="openUserHistoryModal" @unban-user="unbanUser" />
      <AutoModSettings v-if="activeTab === 'automod'" v-model="automod" :roles="roles" @save="saveChanges" />
      <GeneralSettings v-if="activeTab === 'general'" v-model="maxMessagesCleared" @save="saveChanges" />
    </div>
    
    <AuditLogDetailModal :is-open="!!selectedCase" :log="selectedCase" @close="closeCaseModal" />
    <UserModHistoryModal
      :is-open="!!selectedUserForHistory"
      :user="selectedUserForHistory"
      :history="userAuditLog"
      :notes="userNotes"
      @close="closeUserHistoryModal"
      @action="performModerationAction"
      @add-note="addModeratorNote"
    />
    <ModerationActionModal
      :is-open="isActionModalOpen"
      :action-info="actionInfo"
      @close="closeActionModal"
      @submit="confirmModerationAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GeneralSettings from '@/components/moderation/GeneralSettings.vue';
import AutoModSettings from '@/components/moderation/AutoModSettings.vue';
import ModerationCases from '@/components/moderation/ModerationCases.vue';
import MutedMembers from '@/components/moderation/MutedMembers.vue';
import BannedMembers from '@/components/moderation/BannedMembers.vue';
import ModerationOverview from '@/components/moderation/ModerationOverview.vue';
import Users from '@/components/moderation/Users.vue';
import ModeratorLeaderboard from '@/components/moderation/ModeratorLeaderboard.vue';
import AuditLogDetailModal from '@/components/audit-log/AuditLogDetailModal.vue';
import UserModHistoryModal from '@/components/audit-log/UserModHistoryModal.vue';
import ModerationActionModal from '@/components/moderation/ModerationActionModal.vue';
import { useModeration } from '@/composables/useModeration';

const activeTab = ref('overview');

const {
  maxMessagesCleared,
  automod,
  roles,
  mutedUsers,
  bannedUsers,
  moderationCases,
  allUsers,
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
  modActionsChartData,
  moderatorLeaderboardData,
  isActionModalOpen,
  actionInfo,
  closeActionModal,
  confirmModerationAction,
  addModeratorNote,
} = useModeration();
</script>

