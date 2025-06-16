
<template>
  <div>
    <h3 class="text-lg font-medium text-white mb-3">Reactions & Roles</h3>
    <div class="space-y-4">
      <ReactionRoleMappingItem
        v-for="(mapping, mappingIndex) in mappings"
        :key="mappingIndex"
        :mapping="mapping"
        :mapping-index="mappingIndex"
        @update:mapping="updateMapping(mappingIndex, $event)"
        @remove-mapping="removeMapping(mappingIndex)"
        @add-role="addRole(mappingIndex)"
        @remove-role="removeRole(mappingIndex, $event)"
      />
    </div>
    <button @click="addMapping" class="mt-4 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      <span>Add Emoji Reaction</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import ReactionRoleMappingItem from './ReactionRoleMappingItem.vue';
import type { ReactionMapping, Role } from '@/types/reaction-roles';

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

const props = defineProps<{
  mappings: ReactionMappingFormData[];
}>();

const emit = defineEmits<{
  (e: 'update:mappings', value: ReactionMappingFormData[]): void;
}>();

const updateMappings = (newMappings: ReactionMappingFormData[]) => {
  emit('update:mappings', newMappings);
};

const addMapping = () => {
  const newMappings = [...props.mappings, { emoji: '', roles: [{ roleName: '' }] }];
  updateMappings(newMappings);
};

const removeMapping = (index: number) => {
  const newMappings = [...props.mappings];
  newMappings.splice(index, 1);
  updateMappings(newMappings);
};

const addRole = (mappingIndex: number) => {
  const newMappings = [...props.mappings];
  newMappings[mappingIndex].roles.push({ roleName: '' });
  updateMappings(newMappings);
};

const removeRole = (mappingIndex: number, roleIndex: number) => {
  const newMappings = [...props.mappings];
  newMappings[mappingIndex].roles.splice(roleIndex, 1);
  if (newMappings[mappingIndex].roles.length === 0) {
    removeMapping(mappingIndex);
  } else {
    updateMappings(newMappings);
  }
};

const updateMapping = (index: number, updatedMapping: ReactionMappingFormData) => {
  const newMappings = [...props.mappings];
  newMappings[index] = updatedMapping;
  updateMappings(newMappings);
};
</script>
