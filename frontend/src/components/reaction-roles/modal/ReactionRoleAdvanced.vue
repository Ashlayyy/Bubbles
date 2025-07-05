
<template>
  <div>
    <h3 class="text-lg font-medium text-white mb-4">Advanced Settings</h3>
    <div class="space-y-6 bg-slate-800/50 p-5 rounded-lg border border-slate-700/50">
      <!-- Exclusive Roles Toggle -->
      <div class="flex items-start justify-between">
        <div>
          <label for="exclusiveRoles" class="font-medium text-slate-200">Exclusive Roles</label>
          <p class="text-sm text-slate-400 mt-1 max-w-sm">When enabled, users can only select one role from this message. Choosing another role will remove the previous one.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer mt-1">
          <input type="checkbox" id="exclusiveRoles" :checked="exclusive" @change="$emit('update:exclusive', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div class="border-t border-slate-700/50 !my-4"></div>

      <!-- Prerequisite Roles -->
      <div>
        <label class="font-medium text-slate-200 block">Prerequisite Roles</label>
        <p class="text-sm text-slate-400 mt-1 mb-3">Users must have these roles to be able to get a role from this message.</p>
        <div class="bg-slate-700 border border-slate-600 rounded-lg p-3 min-h-[90px] flex items-center justify-center">
          <p class="text-slate-400 text-sm">A role selector component will be implemented here.</p>
          <!-- Prerequisite role selection component would go here -->
        </div>
      </div>

      <div class="border-t border-slate-700/50 !my-4"></div>

      <!-- Remove role on un-react -->
      <div class="flex items-start justify-between">
        <div>
          <label for="removeOnUnreact" class="font-medium text-slate-200">Remove Role on Un-react</label>
          <p class="text-sm text-slate-400 mt-1 max-w-sm">When enabled, the role will be removed if the user removes their reaction.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer mt-1">
          <input type="checkbox" id="removeOnUnreact" :checked="removeOnUnreact" @change="$emit('update:removeOnUnreact', ($event.target as HTMLInputElement).checked)" class="sr-only peer">
          <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Role } from '@/types/reaction-roles';

interface RoleFormData extends Omit<Role, 'roleId'> {
  roleId?: string;
}

defineProps<{
  exclusive: boolean;
  prerequisiteRoles?: RoleFormData[];
  removeOnUnreact?: boolean;
}>();

defineEmits<{
  (e: 'update:exclusive', value: boolean): void;
  (e: 'update:prerequisiteRoles', value: RoleFormData[]): void;
  (e: 'update:removeOnUnreact', value: boolean): void;
}>();
</script>
