import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import logger from "../logger.js";
import { cacheService } from "./cacheService.js";

/**
 * Centralized API Client for the Discord Bot
 * Handles authentication, rate limiting, error handling, and provides
 * a clean interface for all API calls to the backend services.
 */
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = process.env.API_URL || "http://localhost:3001";
    this.token = process.env.API_TOKEN || "";

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        logger.debug(`API Request: ${String(config.method?.toUpperCase())} ${String(config.url)}`, {
          method: config.method,
          url: config.url,
          hasAuth: !!config.headers.Authorization,
        });

        return config;
      },
      (error) => {
        logger.error("API Request Error:", error);
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );

    // Response interceptor - Handle common errors and rate limits
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug(`API Response: ${String(response.status)} ${response.config.url ?? "unknown"}`, {
          status: response.status,
          url: response.config.url,
          hasData: !!response.data,
        });

        return response;
      },
      async (error: AxiosError) => {
        const status = error.response?.status;
        const config = error.config as AxiosRequestConfig & { _retry?: boolean };

        logger.error(`API Error: ${String(status ?? "unknown")} ${config?.url ?? "unknown"}`, {
          status,
          url: config?.url,
          message: error.message,
          data: error.response?.data,
        });

        // Handle rate limiting (429)
        if (status === 429 && !config._retry) {
          const retryAfter =
            error.response?.headers["retry-after"] ?? error.response?.headers["x-ratelimit-reset-after"];

          if (retryAfter) {
            const delayMs = Math.ceil(parseFloat(retryAfter) * 1000);
            logger.warn(`Rate limited, retrying after ${String(delayMs)}ms`);

            config._retry = true;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return this.client(config);
          }
        }

        // Handle auth errors (401)
        if (status === 401) {
          logger.error("API Authentication failed - check API_TOKEN");
        }

        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  }

  /**
   * Generic GET request with caching support
   */
  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    config?: AxiosRequestConfig & { cache?: boolean; cacheTTL?: number }
  ): Promise<T> {
    const cacheKey = this.buildCacheKey("GET", endpoint, params);
    const shouldCache = config?.cache !== false; // Cache by default
    const cacheTTL = config?.cacheTTL;

    // Try to get from cache first
    if (shouldCache) {
      const cached = await cacheService.get<T>(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit for ${endpoint}`);
        return cached;
      }
    }

    try {
      const response = await this.client.get<T>(endpoint, { params, ...config });

      // Cache the response
      if (shouldCache) {
        cacheService.set(cacheKey, response.data, cacheTTL);
        logger.debug(`Cached response for ${endpoint}`);
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError, "GET", endpoint);
    }
  }

  /**
   * Generic POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig & { invalidateCache?: string[] }
  ): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, data, config);

      // Invalidate related cache entries
      if (config?.invalidateCache) {
        for (const pattern of config.invalidateCache) {
          cacheService.invalidatePattern(pattern);
        }
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError, "POST", endpoint);
    }
  }

  /**
   * Generic PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig & { invalidateCache?: string[] }
  ): Promise<T> {
    try {
      const response = await this.client.put<T>(endpoint, data, config);

      // Invalidate related cache entries
      if (config?.invalidateCache) {
        for (const pattern of config.invalidateCache) {
          cacheService.invalidatePattern(pattern);
        }
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError, "PUT", endpoint);
    }
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig & { invalidateCache?: string[] }): Promise<T> {
    try {
      const response = await this.client.delete<T>(endpoint, config);

      // Invalidate related cache entries
      if (config?.invalidateCache) {
        for (const pattern of config.invalidateCache) {
          cacheService.invalidatePattern(pattern);
        }
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError, "DELETE", endpoint);
    }
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig & { invalidateCache?: string[] }
  ): Promise<T> {
    try {
      const response = await this.client.patch<T>(endpoint, data, config);

      // Invalidate related cache entries
      if (config?.invalidateCache) {
        for (const pattern of config.invalidateCache) {
          cacheService.invalidatePattern(pattern);
        }
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError, "PATCH", endpoint);
    }
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: AxiosError, method: string, endpoint: string): Error {
    const status = error.response?.status;
    const message = error.response?.data
      ? ((error.response.data as any).error ?? (error.response.data as any).message ?? error.message)
      : error.message;

    logger.error(`API ${method} ${endpoint} failed:`, {
      status,
      message,
      endpoint,
      method,
    });

    // Create a more informative error
    const apiError = new Error(`API ${method} ${endpoint} failed: ${message}`);
    (apiError as any).status = status;
    (apiError as any).endpoint = endpoint;
    (apiError as any).method = method;

    return apiError;
  }

  /**
   * Build cache key from request parameters
   */
  private buildCacheKey(method: string, url: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : "";
    return `${method}:${url}:${paramString}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if the API client is properly configured
   */
  isConfigured(): boolean {
    return !!this.token && !!this.baseURL;
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Update the API token (useful for testing or runtime updates)
   */
  updateToken(token: string): void {
    this.token = token;
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Also export the class for testing
export { ApiClient };

/**
 * Common API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination response wrapper
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
}
