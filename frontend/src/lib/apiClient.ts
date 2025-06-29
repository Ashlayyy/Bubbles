import axios, {
	AxiosError,
	AxiosInstance,
	AxiosResponse,
	InternalAxiosRequestConfig,
	AxiosRequestHeaders,
	AxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import Bottleneck from 'bottleneck';

// Lazy singleton so stores are available after Pinia initialises
let api: AxiosInstance | null = null;

// ----------------------------------------------------------------------------
// ⏱️  Rate-limit handling
// ----------------------------------------------------------------------------
// A single limiter instance for every request made through apiClient.  Discord
// global application limit is 50 req/second per token – we stay way below that.
// We also keep a low concurrency to avoid browser-side flooding.
const limiter = new Bottleneck({
	maxConcurrent: 4, // at most 4 parallel HTTP calls
	minTime: 250, // ~4 requests per second sustained
});

/**
 * Utility that wraps a promise-returning fn in the Bottleneck schedule.
 */
const schedule = <T>(fn: () => Promise<T>): Promise<T> => limiter.schedule(fn);

function createApiClient(): AxiosInstance {
	const instance = axios.create({
		baseURL: import.meta.env.VITE_API_URL || '/api/v1',
		headers: {
			'Content-Type': 'application/json',
		},
		withCredentials: true, // Include cookies for session management
	});

	// ---------------------------------------------------------------------
	// Request interceptor – attach JWT & run through limiter
	// ---------------------------------------------------------------------
	instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
		const auth = useAuthStore();
		if (auth.token) {
			// Axios 1.x uses AxiosHeaders – cast for mutation convenience
			(
				config.headers as AxiosRequestHeaders
			).Authorization = `Bearer ${auth.token}`;
		}
		// Wrap the config in the limiter so the request is queued before it is
		// sent.  We can simply resolve with the same config because Axios will
		// proceed only after the promise resolves.
		return schedule(() => Promise.resolve(config));
	});

	// ---------------------------------------------------------------------
	// Response interceptors – ratelimit & auth handling
	// ---------------------------------------------------------------------
	instance.interceptors.response.use(
		(res: AxiosResponse) => {
			// If the API forwards Discord rate-limit headers we respect them.
			const rlRemaining = res.headers['x-ratelimit-remaining'];
			const rlResetAfter = res.headers['x-ratelimit-reset-after'];

			if (rlRemaining !== undefined && rlRemaining === '0' && rlResetAfter) {
				const pauseMs = Math.ceil(parseFloat(rlResetAfter) * 1000);
				limiter.schedule(() => new Promise((r) => setTimeout(r, pauseMs)));
			}

			return res;
		},
		async (error: AxiosError) => {
			const toast = useToastStore();
			const auth = useAuthStore();

			const originalRequest = error.config as AxiosRequestConfig & {
				_retry?: boolean;
			};

			const status = error.response?.status;

			// 429 handling – obey Retry-After and retry once
			if (status === 429) {
				const retryAfter =
					(error.response?.headers?.['retry-after'] as string | undefined) ??
					(error.response?.headers?.['x-ratelimit-reset-after'] as
						| string
						| undefined);

				if (retryAfter && !originalRequest._retry) {
					const pauseMs = Math.ceil(parseFloat(retryAfter) * 1000);
					await new Promise((r) => setTimeout(r, pauseMs));
					originalRequest._retry = true;
					return instance(originalRequest);
				}
			}

			if (status === 401 && originalRequest.url !== '/auth/me') {
				if (!originalRequest._retry) {
					originalRequest._retry = true;
					try {
						await auth.refreshToken();
						return instance(originalRequest);
					} catch (e) {
						// Refresh failed ⇒ logout
						await auth.logout();
						toast.addToast('Session expired, please login again', 'error');
					}
				}
			} else if (error.response) {
				const apiError =
					(error.response.data as unknown as { error?: string })?.error ||
					error.response.statusText;
				toast.addToast(apiError, 'error');
			} else {
				toast.addToast('Network error, please try again', 'error');
			}

			return Promise.reject(error);
		}
	);

	return instance;
}

export const apiClient = (): AxiosInstance => {
	if (!api) api = createApiClient();
	return api;
};
