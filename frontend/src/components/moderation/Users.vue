
<template>
  <div class="bg-card border border-border rounded-xl">
    <div class="p-6 border-b border-border">
      <h2 class="text-xl font-semibold text-card-foreground">Users</h2>
      <p class="text-muted-foreground mt-1">Search for users and view their moderation history.</p>
    </div>
    <div class="p-6">
      <div class="mb-4 max-w-sm">
        <input v-model="searchQuery" type="text" placeholder="Search by name or ID..." class="w-full bg-input border border-input rounded-lg px-3 py-2 text-foreground text-sm focus:ring-ring focus:border-ring">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left text-muted-foreground">
          <thead class="text-xs text-muted-foreground uppercase bg-secondary/50">
            <tr>
              <th scope="col" class="px-6 py-3">User</th>
              <th scope="col" class="px-6 py-3">User ID</th>
              <th scope="col" class="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="3" class="text-center py-10 text-muted-foreground">No users found.</td>
            </tr>
            <tr v-else v-for="user in paginatedUsers" :key="user.id" class="border-b border-border">
              <td class="px-6 py-4 font-medium text-foreground">
                <a href="#" @click.prevent="$emit('user-selected', user)" class="hover:underline">
                  @{{ user.name }}
                </a>
              </td>
              <td class="px-6 py-4">{{ user.id }}</td>
              <td class="px-6 py-4 text-right">
                <button @click="$emit('user-selected', user)" class="font-medium text-primary hover:text-primary/90 hover:underline">View History</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex justify-between items-center pt-4 text-sm">
        <p class="text-muted-foreground">
          Showing
          <span class="font-medium text-foreground">{{ filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0 }}</span>
          to
          <span class="font-medium text-foreground">{{ (currentPage - 1) * itemsPerPage + paginatedUsers.length }}</span>
          of
          <span class="font-medium text-foreground">{{ filteredUsers.length }}</span>
          results
        </p>
        <div v-if="totalPages > 1" class="inline-flex items-center gap-2">
          <button @click="prevPage" :disabled="currentPage === 1" class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <span class="text-muted-foreground">Page {{ currentPage }} of {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage === totalPages" class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { AuditLogUser } from '@/types/audit-log';

const props = defineProps<{
  users: AuditLogUser[];
}>();

defineEmits<{
  (e: 'user-selected', user: AuditLogUser): void;
}>();

const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(10);

watch(searchQuery, () => {
  currentPage.value = 1;
});

const filteredUsers = computed(() => {
  if (!searchQuery.value) {
    return props.users;
  }
  const lowerQuery = searchQuery.value.toLowerCase();
  return props.users.filter(user =>
    user.name.toLowerCase().includes(lowerQuery) ||
    user.id.toLowerCase().includes(lowerQuery)
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage.value);
});

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredUsers.value.slice(start, end);
});

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};
</script>
