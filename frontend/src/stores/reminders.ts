import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { remindersEndpoints } from '@/lib/endpoints/reminders';

export interface Reminder {
  id: string;
  userId: string;
  username: string;
  channelId: string;
  channelName: string;
  message: string;
  createdAt: string;
  remindAt: string;
  completed: boolean;
}

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

function mapReminder(raw: Record<string, unknown>): Reminder {
  const reminderTime = raw.reminderTime || raw.triggerAt || raw.remindAt;
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? ''),
    username: String(raw.username ?? raw.userId ?? 'user'),
    channelId: String(raw.channelId ?? ''),
    channelName: String(raw.channelName ?? raw.channelId ?? ''),
    message: String(raw.content ?? raw.message ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    remindAt: String(reminderTime ?? ''),
    completed: String(raw.status ?? '').toUpperCase() === 'COMPLETED' || Boolean(raw.completed),
  };
}

export const useRemindersStore = defineStore('reminders', () => {
  const reminders = ref<Reminder[]>([]);
  const guildId = ref('');

  const activeReminders = computed(() => reminders.value.filter((item) => !item.completed));
  const completedReminders = computed(() => reminders.value.filter((item) => item.completed));

  const load = async (id: string) => {
    guildId.value = id;
    const res = await remindersEndpoints.getReminders(id);
    const payload = unwrap<{ reminders?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      res.data
    );
    const list = Array.isArray(payload) ? payload : payload.reminders ?? [];
    reminders.value = list.map((item) => mapReminder(item));
  };

  const addReminder = async (reminder: {
    channelId: string;
    message: string;
    remindAt: string;
  }) => {
    await remindersEndpoints.create(guildId.value, {
      channelId: reminder.channelId,
      content: reminder.message,
      triggerAt: reminder.remindAt,
    });
    await load(guildId.value);
  };

  const completeReminder = async (id: string) => {
    await remindersEndpoints.cancel(guildId.value, id);
    await load(guildId.value);
  };

  const deleteReminder = async (id: string) => {
    await remindersEndpoints.delete(guildId.value, id);
    await load(guildId.value);
  };

  return {
    reminders,
    activeReminders,
    completedReminders,
    load,
    addReminder,
    completeReminder,
    deleteReminder,
  };
});
