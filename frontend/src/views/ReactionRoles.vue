
<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-white">Reaction Roles</h1>
      <button @click="openCreateModal" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <span>Create New</span>
      </button>
    </div>

    <div v-if="reactionRoleMessages.length > 0" class="space-y-8 max-w-4xl">
      <div v-for="message in reactionRoleMessages" :key="message.id" class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden animate-fade-in">
        <div class="p-6 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold text-white">Message in <span class="text-blue-400">#{{ message.channelName }}</span></h2>
            <div class="flex items-center flex-wrap gap-x-4 gap-y-2 mt-2">
              <p class="text-sm text-slate-500">Message ID: {{ message.messageId }}</p>
              <div v-if="message.exclusive" class="flex items-center space-x-1.5 text-xs font-medium text-amber-300 bg-amber-900/50 border border-amber-500/30 px-2.5 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5v17"/><path d="m19 10.5-7-7-7 7"/></svg>
                <span>Exclusive Roles</span>
              </div>
              <div v-if="message.prerequisiteRoles && message.prerequisiteRoles.length > 0" class="flex items-center space-x-1.5 text-xs font-medium text-cyan-300 bg-cyan-900/50 border border-cyan-500/30 px-2.5 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12H8m4 8H8m4-4H8m12 0h-4m4-4h-4m4-4h-4"/>
                </svg>
                <span>Prerequisites</span>
              </div>
              <div v-if="message.removeOnUnreact" class="flex items-center space-x-1.5 text-xs font-medium text-purple-300 bg-purple-900/50 border border-purple-500/30 px-2.5 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v17"/><path d="m19 10.5-7-7-7 7"/></svg>
                <span>Remove on Un-react</span>
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-2 flex-shrink-0">
            <button @click="openEditModal(message)" class="text-slate-400 hover:text-white p-2 rounded-md hover:bg-slate-700 transition-colors" aria-label="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
             <button @click="deleteMessage(message.id)" class="text-slate-400 hover:text-red-400 p-2 rounded-md hover:bg-slate-700 transition-colors" aria-label="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
        
        <div class="p-6">
          <div class="bg-slate-800/50 border-l-4 border-blue-500 rounded-r-md p-4">
            <p class="text-slate-300 whitespace-pre-wrap">{{ message.messageContent }}</p>
          </div>

          <div class="mt-6">
            <h3 class="text-lg font-medium text-white mb-3">Roles</h3>
            <div class="space-y-3">
              <div v-for="mapping in message.mappings" :key="mapping.emoji" class="flex items-start space-x-4 bg-slate-800 p-3 rounded-lg">
                <div class="text-2xl mt-1">{{ mapping.emoji }}</div>
                <div class="text-slate-400 text-lg mt-1">→</div>
                <div class="flex flex-wrap gap-2 flex-1">
                  <div v-for="role in mapping.roles" :key="role.roleId" class="font-medium text-white px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-md">@{{ role.roleName }}</div>
                </div>
                <div v-if="mapping.duration" class="flex items-center space-x-1.5 text-xs font-medium text-teal-300 bg-teal-900/50 border border-teal-500/30 px-2.5 py-1 rounded-full self-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>{{ mapping.duration.value }} {{ mapping.duration.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center max-w-4xl mx-auto">
      <div class="w-16 h-16 bg-slate-800 rounded-full mx-auto flex items-center justify-center mb-4">
        <span class="text-3xl">👍</span>
      </div>
      <h2 class="text-xl font-semibold text-white">No Reaction Roles Found</h2>
      <p class="text-slate-400 mt-2">Click 'Create New' to set up your first reaction role message.</p>
    </div>

    <ReactionRoleModal
      :is-open="isModalOpen"
      :message-to-edit="selectedMessage"
      @close="closeModal"
      @save="saveMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ReactionRoleModal from '@/components/reaction-roles/ReactionRoleModal.vue';
import type { ReactionRoleMessage, ReactionMapping, Role } from '@/types/reaction-roles';

const reactionRoleMessages = ref<ReactionRoleMessage[]>([
  {
    id: 'rr-1',
    channelId: 'channel-123',
    channelName: 'rules-and-roles',
    messageContent: 'React to this message to get your roles!\n\n👍 - General Access\n🚀 - Project Updates',
    mappings: [
      { 
        emoji: '👍', 
        roles: [
          { roleId: 'role-1', roleName: 'Member' },
          { roleId: 'role-access', roleName: 'General Channels Access' },
        ],
        duration: { value: 7, unit: 'days' }
      },
      { 
        emoji: '🚀', 
        roles: [
          { roleId: 'role-2', roleName: 'Announcements' }
        ]
      },
      {
        emoji: '🎨',
        roles: [
          { roleId: 'role-3', roleName: 'Artist' }
        ]
      }
    ],
    exclusive: true,
    removeOnUnreact: true,
  },
  {
    id: 'rr-2',
    channelId: 'channel-456',
    channelName: 'team-selection',
    messageId: 'msg-def-456',
    messageContent: 'Choose your team for the event!\n\n🔴 - Team Red\n🔵 - Team Blue',
    mappings: [
      { 
        emoji: '🔴', 
        roles: [{ roleId: 'role-4', roleName: 'Team Red' }]
      },
      { 
        emoji: '🔵',
        roles: [{ roleId: 'role-5', roleName: 'Team Blue' }]
      },
    ],
    prerequisiteRoles: [
      { roleId: 'role-verified', roleName: 'Verified' }
    ]
  }
]);

const isModalOpen = ref(false);
const selectedMessage = ref<ReactionRoleMessage | null>(null);

const openCreateModal = () => {
  selectedMessage.value = null;
  isModalOpen.value = true;
};

const openEditModal = (message: ReactionRoleMessage) => {
  selectedMessage.value = JSON.parse(JSON.stringify(message));
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  selectedMessage.value = null;
};

const deleteMessage = (messageId: string) => {
  if (confirm('Are you sure you want to delete this reaction role message?')) {
    reactionRoleMessages.value = reactionRoleMessages.value.filter(m => m.id !== messageId);
  }
};

const saveMessage = (messageData: Omit<ReactionRoleMessage, 'id' | 'channelId' | 'messageId' | 'mappings'> & { id?: string; mappings: (Omit<ReactionMapping, 'roles'> & { roles: (Omit<Role, 'roleId'> & { roleId?: string})[] })[] }) => {
  if (messageData.id) {
    // Update existing
    const index = reactionRoleMessages.value.findIndex(m => m.id === messageData.id);
    if (index !== -1) {
      const updatedMappings = messageData.mappings.map(mapping => ({
        ...mapping,
        roles: mapping.roles.map(role => ({
          ...role,
          roleId: role.roleId || `role-${Date.now()}-${Math.random()}`
        }))
      }));
      reactionRoleMessages.value[index] = { ...reactionRoleMessages.value[index], ...messageData, mappings: updatedMappings as ReactionMapping[] };
    }
  } else {
    // Create new
    const newMappings = messageData.mappings.map(mapping => ({
      ...mapping,
      roles: mapping.roles.map(role => ({
        ...role,
        roleId: `role-${Date.now()}-${Math.random()}`
      }))
    }));
    const newMessage: ReactionRoleMessage = {
      ...messageData,
      id: `rr-${Date.now()}`,
      channelId: `channel-${Date.now()}`, // Mock data
      messageId: `msg-${Date.now()}`, // Mock data
      mappings: newMappings as ReactionMapping[],
    };
    reactionRoleMessages.value.push(newMessage);
  }
  closeModal();
};

</script>
