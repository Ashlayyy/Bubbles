export interface Ticket {
	id: string;
	guildId: string;
	subject: string;
	status: 'open' | 'closed';
	priority: 'low' | 'medium' | 'high' | 'urgent';
	userId: string;
	username: string;
	categoryId: string;
	categoryName: string;
	messages: number;
	assignedStaff: string[];
	createdAt: string;
	closedAt?: string;
}

export interface TicketCategory {
	id: string;
	name: string;
	description: string;
	emoji: string;
	staffRoles: string[];
	channelPrefix: string;
	autoClose: boolean;
	autoCloseTime?: number;
}

export interface TicketPanel {
	id: string;
	title: string;
	description: string;
	channelId: string;
	channelName: string;
	buttonLabel: string;
	buttonColor: string;
	categoryId: string;
}

export interface TicketSettings {
	enabled: boolean;
	archiveChannel: string | null;
	maxOpenTickets: number;
	allowUserClose: boolean;
}
