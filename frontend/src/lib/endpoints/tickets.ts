import { apiClient } from '@/lib/apiClient';

export const ticketsEndpoints = {
	// Settings
	getSettings: (guildId: string) =>
		apiClient().get(`/guilds/${guildId}/tickets/settings`),
	updateSettings: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().put(`/guilds/${guildId}/tickets/settings`, payload),

	// Tickets
	getTickets: (guildId: string, params?: { status?: 'open' | 'closed' }) =>
		apiClient().get(`/guilds/${guildId}/tickets`, { params }),
	getTicket: (guildId: string, ticketId: string) =>
		apiClient().get(`/guilds/${guildId}/tickets/${ticketId}`),
	createTicket: (guildId: string, payload: Record<string, unknown>) =>
		apiClient().post(`/guilds/${guildId}/tickets`, payload),
	updateTicket: (
		guildId: string,
		ticketId: string,
		payload: Record<string, unknown>
	) => apiClient().put(`/guilds/${guildId}/tickets/${ticketId}`, payload),
	closeTicket: (guildId: string, ticketId: string) =>
		apiClient().post(`/guilds/${guildId}/tickets/${ticketId}/close`),
	claimTicket: (guildId: string, ticketId: string) =>
		apiClient().post(`/guilds/${guildId}/tickets/${ticketId}/claim`),

	// Assignment endpoints
	assignTicket: (
		guildId: string,
		ticketId: string,
		payload: { assignedTo: string; reason?: string }
	) =>
		apiClient().post(`/guilds/${guildId}/tickets/${ticketId}/assign`, payload),
	unassignTicket: (
		guildId: string,
		ticketId: string,
		payload: { reason?: string }
	) =>
		apiClient().post(
			`/guilds/${guildId}/tickets/${ticketId}/unassign`,
			payload
		),
	bulkAssignTickets: (
		guildId: string,
		payload: { ticketIds: string[]; assignedTo: string; reason?: string }
	) => apiClient().post(`/guilds/${guildId}/tickets/bulk-assign`, payload),
	autoAssignTickets: (
		guildId: string,
		payload: { staffIds: string[]; maxAssignments?: number }
	) => apiClient().post(`/guilds/${guildId}/tickets/auto-assign`, payload),
	getAssignmentStatistics: (guildId: string, params?: { period?: string }) =>
		apiClient().get(`/guilds/${guildId}/tickets/assignment-statistics`, {
			params,
		}),
};
