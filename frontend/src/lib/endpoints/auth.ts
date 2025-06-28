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
	const { data } = await apiClient().post('/discord/callback', { code, state });
	return data as AuthPayload;
};

export const logout = () => apiClient().post('/auth/logout');
export const me = () => apiClient().get('/auth/me');
export const refresh = () => apiClient().get('/auth/refresh');
