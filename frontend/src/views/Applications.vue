<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-6">Applications</h1>
    <p v-if="error" class="text-destructive mb-4">{{ error }}</p>

    <section class="mb-10">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Forms</h2>
        <button @click="createForm" class="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
          Create form
        </button>
      </div>
      <div v-if="forms.length === 0" class="text-muted-foreground">No application forms yet.</div>
      <div class="grid gap-4 md:grid-cols-2">
        <div v-for="form in forms" :key="form.id" class="bg-card border border-border rounded-lg p-4">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-semibold">{{ form.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ form.description || 'No description' }}</p>
            </div>
            <span class="text-xs">{{ form.isActive ? 'Active' : 'Inactive' }}</span>
          </div>
          <button @click="toggleForm(form)" class="mt-3 text-sm text-primary">
            {{ form.isActive ? 'Disable' : 'Enable' }}
          </button>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4">Submissions</h2>
      <div v-if="applications.length === 0" class="text-muted-foreground">No submissions yet.</div>
      <div class="space-y-3">
        <div v-for="app in applications" :key="app.id" class="bg-card border border-border rounded-lg p-4 flex justify-between">
          <div>
            <p class="font-medium">{{ app.form?.name || 'Application' }}</p>
            <p class="text-sm text-muted-foreground">{{ app.userId }} · {{ app.status }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="setStatus(app.id, 'APPROVED')" class="text-sm text-green-500">Approve</button>
            <button @click="setStatus(app.id, 'REJECTED')" class="text-sm text-red-500">Reject</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { applicationsEndpoints } from '@/lib/endpoints/applications';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const toast = useToastStore();
const error = ref('');
const forms = ref<Array<{ id: string; name: string; description?: string; isActive: boolean }>>([]);
const applications = ref<Array<{ id: string; userId: string; status: string; form?: { name?: string } }>>([]);

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

const guildId = () => route.params.guildId as string;

async function load() {
  error.value = '';
  try {
    const [formsRes, appsRes] = await Promise.all([
      applicationsEndpoints.getForms(guildId()),
      applicationsEndpoints.getApplications(guildId()),
    ]);
    const formPayload = unwrap<typeof forms.value>(formsRes.data);
    forms.value = Array.isArray(formPayload) ? formPayload : [];
    const appPayload = unwrap<{ applications?: typeof applications.value } | typeof applications.value>(
      appsRes.data
    );
    applications.value = Array.isArray(appPayload) ? appPayload : appPayload.applications ?? [];
  } catch {
    error.value = 'Failed to load applications';
  }
}

async function createForm() {
  const name = prompt('Form name');
  if (!name) return;
  try {
    await applicationsEndpoints.createForm(guildId(), {
      name,
      description: '',
      fields: [],
    });
    await load();
    toast.addToast('Form created', 'success');
  } catch {
    toast.addToast('Failed to create form', 'error');
  }
}

async function toggleForm(form: { id: string; isActive: boolean }) {
  try {
    await applicationsEndpoints.updateForm(guildId(), form.id, { isActive: !form.isActive });
    await load();
  } catch {
    toast.addToast('Failed to update form', 'error');
  }
}

async function setStatus(id: string, status: string) {
  try {
    await applicationsEndpoints.statusUpdate(guildId(), id, { status });
    await load();
  } catch {
    toast.addToast('Failed to update application', 'error');
  }
}

onMounted(load);
</script>
