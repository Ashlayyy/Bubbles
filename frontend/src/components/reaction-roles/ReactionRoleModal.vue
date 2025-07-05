
<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" @click.self="handleClose">
    <div class="bg-slate-900 rounded-xl shadow-lg w-full max-w-2xl border border-slate-800 max-h-[90vh] flex flex-col">
      <div class="p-6 border-b border-slate-800 flex justify-between items-center">
        <h2 class="text-xl font-semibold text-white">{{ isEditing ? 'Edit Reaction Role' : 'Create New Reaction Role' }}</h2>
        <button @click="handleClose" class="text-slate-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="p-6 space-y-6 overflow-y-auto">
        <div>
          <label for="channelName" class="block text-sm font-medium text-slate-300 mb-2">Channel Name</label>
          <input type="text" id="channelName" v-model="formData.channelName" placeholder="e.g. #rules-and-roles" class="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors">
        </div>
        <div>
          <label for="messageContent" class="block text-sm font-medium text-slate-300 mb-2">Message Content</label>
          <textarea id="messageContent" v-model="formData.messageContent" rows="6" placeholder="React to this message to get your roles!" class="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors whitespace-pre-wrap"></textarea>
        </div>

        <ReactionRoleMappings v-model:mappings="formData.mappings" />

        <ReactionRoleAdvanced 
          v-model:exclusive="formData.exclusive"
          v-model:prerequisite-roles="formData.prerequisiteRoles"
          v-model:remove-on-unreact="formData.removeOnUnreact"
        />
      </div>

      <div class="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end space-x-4 mt-auto">
        <button @click="handleClose" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Cancel</button>
        <button @click="handleSave" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { ReactionRoleMessage, ReactionMapping, Role } from '@/types/reaction-roles';
import ReactionRoleMappings from './modal/ReactionRoleMappings.vue';
import ReactionRoleAdvanced from './modal/ReactionRoleAdvanced.vue';

interface RoleFormData extends Omit<Role, 'roleId'> {
  roleId?: string;
}

interface ReactionMappingFormData extends Omit<ReactionMapping, 'roles'> {
  roles: RoleFormData[];
  duration?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface ReactionRoleFormData extends Omit<ReactionRoleMessage, 'id' | 'channelId' | 'messageId' | 'mappings' | 'prerequisiteRoles'> {
  id?: string;
  channelName: string;
  messageContent: string;
  mappings: ReactionMappingFormData[];
  prerequisiteRoles?: RoleFormData[];
  removeOnUnreact?: boolean;
}


const props = defineProps<{
  isOpen: boolean;
  messageToEdit: ReactionRoleMessage | null;
}>();

const emit = defineEmits(['close', 'save']);

const isEditing = computed(() => !!props.messageToEdit);

const getInitialFormData = (): ReactionRoleFormData => ({
  channelName: '',
  messageContent: '',
  mappings: [],
  exclusive: false,
  prerequisiteRoles: [],
  removeOnUnreact: false,
});

const formData = ref<ReactionRoleFormData>(getInitialFormData());

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.messageToEdit) {
      // Create a deep copy and merge with defaults to ensure all fields are present
      const editData = JSON.parse(JSON.stringify(props.messageToEdit));
      formData.value = {
        ...getInitialFormData(),
        ...editData,
      };
    } else {
      formData.value = getInitialFormData();
    }
  }
});

const handleSave = () => {
  // Filter out empty mappings or mappings with no roles
  const cleanedFormData = {
    ...formData.value,
    mappings: formData.value.mappings.filter(m => m.emoji && m.roles.length > 0 && m.roles.some(r => r.roleName))
  };
  emit('save', cleanedFormData);
};

const handleClose = () => {
  emit('close');
};
</script>
