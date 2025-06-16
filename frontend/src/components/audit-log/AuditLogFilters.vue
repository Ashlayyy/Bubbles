
<template>
  <div class="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search by user, action, or ID..."
      class="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-blue-500 focus:border-blue-500"
    />
    <select v-model="actionFilter" class="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
      <option value="">Filter by Action</option>
      <option value="MEMBER_BAN_ADD">Ban</option>
      <option value="MEMBER_KICK">Kick</option>
      <option value="ROLE_UPDATE">Role Update</option>
      <option value="MESSAGE_BULK_DELETE">Message Bulk Delete</option>
      <option value="MESSAGE_DELETE">Message Delete</option>
      <option value="ROLE_CREATE">Role Create</option>
    </select>
    <select v-model="sourceFilter" class="col-span-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
      <option value="">Filter by Source</option>
      <option value="DISCORD">Discord</option>
      <option value="BUBBLES">Bubbles</option>
    </select>
    <div class="relative col-span-1">
      <label for="start-date" class="absolute -top-2.5 left-3 text-xs text-slate-400 bg-slate-900 px-1 z-10">Start Date</label>
      <input
        id="start-date"
        v-model="startDate"
        type="date"
        class="relative w-full bg-transparent border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <div class="relative col-span-1">
      <label for="end-date" class="absolute -top-2.5 left-3 text-xs text-slate-400 bg-slate-900 px-1 z-10">End Date</label>
      <input
        id="end-date"
        v-model="endDate"
        type="date"
        class="relative w-full bg-transparent border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const searchQuery = defineModel<string>('searchQuery');
const actionFilter = defineModel<string>('actionFilter');
const sourceFilter = defineModel<string>('sourceFilter');
const startDate = defineModel<string>('startDate');
const endDate = defineModel<string>('endDate');
</script>
