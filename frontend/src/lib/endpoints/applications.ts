import { apiClient } from '@/lib/apiClient';

export const applicationsEndpoints = {
	getApplications: (
		guildId: string,
		params?: { page?: number; limit?: number; status?: string; formId?: string }
	) => apiClient().get(`/guilds/${guildId}/applications`, { params }),

	submit: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/applications`, payload),

	getApplication: (guildId: string, applicationId: string) =>
		apiClient().get(`/guilds/${guildId}/applications/${applicationId}`),

	statusUpdate: (
		guildId: string,
		applicationId: string,
		payload: { status: string; notes?: string }
	) =>
		apiClient().patch(
			`/guilds/${guildId}/applications/${applicationId}/status`,
			payload
		),

	// Forms CRUD
	getForms: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/applications/forms`),

	createForm: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/applications/forms`, payload),

	updateForm: (
		guildId: string,
		formId: string,
		payload: Record<string, unknown>
	) =>
		apiClient().put(`/guilds/${guildId}/applications/forms/${formId}`, payload),

	deleteForm: (guildId: string, formId: string) =>
		apiClient().delete(`/guilds/${guildId}/applications/forms/${formId}`),
};
