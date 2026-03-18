import { API_BASE_URL } from '../constants';
import type { RobloxErrorDetail } from './types';

export class RobloxApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status: number,
		public readonly details?: unknown[],
	) {
		super(message);
		this.name = 'RobloxApiError';
	}
}

export interface ApiClientOptions {
	getApiKey: () => Promise<string | undefined>;
	onRateLimitUpdate?: (category: string, remaining: number, limit: number) => void;
}

export class RobloxApiClient {
	private readonly baseUrl = API_BASE_URL;
	private readonly maxRetries = 3;
	private readonly baseDelayMs = 1000;

	constructor(private readonly options: ApiClientOptions) {}

	async request<T>(
		method: string,
		path: string,
		opts?: {
			query?: Record<string, string | number | boolean | undefined>;
			body?: unknown;
		},
	): Promise<T> {
		const apiKey = await this.options.getApiKey();
		if (!apiKey) {
			throw new RobloxApiError('UNAUTHENTICATED', 'No API key configured', 401);
		}

		const url = this.buildUrl(path, opts?.query);
		const headers: Record<string, string> = {
			'x-api-key': apiKey,
			Accept: 'application/json',
		};
		if (opts?.body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}

		let lastError: unknown;
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const response = await fetch(url, {
					method,
					headers,
					body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
				});

				this.trackRateLimit(path, response);

				if (response.ok) {
					if (response.status === 204 || response.headers.get('content-length') === '0') {
						return undefined as T;
					}
					return (await response.json()) as T;
				}

				const errorBody = await response.json().catch(() => ({
					code: 'UNKNOWN',
					message: response.statusText,
				}));
				const err = errorBody as RobloxErrorDetail;
				const apiError = new RobloxApiError(
					err.code || 'UNKNOWN',
					err.message || response.statusText,
					response.status,
					err.details,
				);

				if (!this.isRetryable(response.status) || attempt === this.maxRetries) {
					throw apiError;
				}
				lastError = apiError;
			} catch (error) {
				if (error instanceof RobloxApiError) {
					throw error;
				}
				// Network error — retryable
				if (attempt === this.maxRetries) {
					throw error;
				}
				lastError = error;
			}

			const delay = Math.min(this.baseDelayMs * 2 ** attempt + Math.random() * 1000, 30000);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		throw lastError;
	}

	private buildUrl(
		path: string,
		query?: Record<string, string | number | boolean | undefined>,
	): string {
		const url = new URL(`${this.baseUrl}${path}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}
		return url.toString();
	}

	private isRetryable(status: number): boolean {
		return status === 429 || status === 503 || status === 504;
	}

	private trackRateLimit(path: string, response: Response): void {
		if (!this.options.onRateLimitUpdate) return;

		// Determine category from path pattern
		let category = 'read';
		if (path.includes(':listRevisions')) {
			category = 'revision';
		} else if (path.includes('/data-stores') && !path.includes('/entries')) {
			category = 'list';
		}

		const remaining = response.headers.get('x-ratelimit-remaining');
		const limit = response.headers.get('x-ratelimit-limit');
		if (remaining && limit) {
			this.options.onRateLimitUpdate(category, Number(remaining), Number(limit));
		}
	}
}
