import type { RobloxApiClient } from './client';
import type { DataStoreEntry, ListEntriesResponse } from './types';

export class EntriesService {
	constructor(private readonly client: RobloxApiClient) {}

	async list(
		universeId: string,
		dataStoreId: string,
		opts?: {
			scope?: string;
			maxPageSize?: number;
			pageToken?: string;
			filter?: string;
			showDeleted?: boolean;
		},
	): Promise<ListEntriesResponse> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries`;

		return this.client.request<ListEntriesResponse>('GET', basePath, {
			query: {
				maxPageSize: opts?.maxPageSize,
				pageToken: opts?.pageToken,
				filter: opts?.filter,
				showDeleted: opts?.showDeleted,
			},
		});
	}

	async get(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		opts?: { scope?: string; revisionId?: string; timestamp?: string },
	): Promise<DataStoreEntry> {
		let resolvedEntryId = encodeURIComponent(entryId);
		if (opts?.revisionId) {
			resolvedEntryId = `${resolvedEntryId}@${encodeURIComponent(opts.revisionId)}`;
		} else if (opts?.timestamp) {
			resolvedEntryId = `${resolvedEntryId}@latest:${opts.timestamp}`;
		}

		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries/${resolvedEntryId}`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries/${resolvedEntryId}`;

		return this.client.request<DataStoreEntry>('GET', basePath);
	}

	async create(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		value: unknown,
		opts?: { scope?: string },
	): Promise<DataStoreEntry> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries`;

		return this.client.request<DataStoreEntry>('POST', basePath, {
			query: { id: entryId },
			body: { value },
		});
	}

	async update(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		value: unknown,
		opts?: { scope?: string; allowMissing?: boolean },
	): Promise<DataStoreEntry> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries/${encodeURIComponent(entryId)}`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries/${encodeURIComponent(entryId)}`;

		return this.client.request<DataStoreEntry>('PATCH', basePath, {
			query: { allowMissing: opts?.allowMissing },
			body: { value },
		});
	}

	async delete(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		opts?: { scope?: string },
	): Promise<void> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries/${encodeURIComponent(entryId)}`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries/${encodeURIComponent(entryId)}`;

		await this.client.request('DELETE', basePath);
	}

	async increment(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		amount: number,
		opts?: { scope?: string },
	): Promise<DataStoreEntry> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries/${encodeURIComponent(entryId)}:increment`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries/${encodeURIComponent(entryId)}:increment`;

		return this.client.request<DataStoreEntry>('POST', basePath, {
			body: { amount },
		});
	}
}
