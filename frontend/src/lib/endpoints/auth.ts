import { apiClient } from '@/lib/apiClient';
import type { User } from '@/stores/auth';

interface LoginResponse {
	redirectUrl: string;
	state: string;
}

interface AuthPayload {
	user: User;
	token: string;
	expiresIn: number;
}

export const discordLogin = async () => {
	const { data } = await apiClient().post('/auth/discord/login');
	return data as LoginResponse;
};

export const handleCallback = async (code: string, state?: string) => {
	const { data } = await apiClient().post('/auth/discord/callback', {
		code,
		state,
	});
	// API wraps payload inside "data" property. Fall back if not present.
	const payload =
		(data as { data?: AuthPayload }).data ?? (data as AuthPayload);
	return payload as AuthPayload;
};

export const logout = () => apiClient().post('/auth/logout');
export const me = () => apiClient().get('/auth/me');
export const refresh = () => apiClient().get('/auth/refresh');
