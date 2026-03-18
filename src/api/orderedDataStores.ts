import type { RobloxApiClient } from './client';
import type { ListOrderedEntriesResponse, OrderedDataStoreEntry } from './types';

export class OrderedDataStoresService {
	constructor(private readonly client: RobloxApiClient) {}

	private basePath(universeId: string, dataStoreId: string, scopeId: string): string {
		return `/universes/${universeId}/ordered-data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scopeId)}/entries`;
	}

	async listEntries(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		opts?: {
			maxPageSize?: number;
			pageToken?: string;
			orderBy?: string;
			filter?: string;
		},
	): Promise<ListOrderedEntriesResponse> {
		return this.client.request<ListOrderedEntriesResponse>(
			'GET',
			this.basePath(universeId, dataStoreId, scopeId),
			{
				query: {
					maxPageSize: opts?.maxPageSize,
					pageToken: opts?.pageToken,
					orderBy: opts?.orderBy,
					filter: opts?.filter,
				},
			},
		);
	}

	async getEntry(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		entryId: string,
	): Promise<OrderedDataStoreEntry> {
		return this.client.request<OrderedDataStoreEntry>(
			'GET',
			`${this.basePath(universeId, dataStoreId, scopeId)}/${encodeURIComponent(entryId)}`,
		);
	}

	async createEntry(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		entryId: string,
		value: number,
	): Promise<OrderedDataStoreEntry> {
		return this.client.request<OrderedDataStoreEntry>(
			'POST',
			this.basePath(universeId, dataStoreId, scopeId),
			{
				query: { id: entryId },
				body: { value },
			},
		);
	}

	async updateEntry(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		entryId: string,
		value: number,
		opts?: { allowMissing?: boolean },
	): Promise<OrderedDataStoreEntry> {
		return this.client.request<OrderedDataStoreEntry>(
			'PATCH',
			`${this.basePath(universeId, dataStoreId, scopeId)}/${encodeURIComponent(entryId)}`,
			{
				query: { allowMissing: opts?.allowMissing },
				body: { value },
			},
		);
	}

	async deleteEntry(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		entryId: string,
	): Promise<void> {
		await this.client.request(
			'DELETE',
			`${this.basePath(universeId, dataStoreId, scopeId)}/${encodeURIComponent(entryId)}`,
		);
	}

	async incrementEntry(
		universeId: string,
		dataStoreId: string,
		scopeId: string,
		entryId: string,
		amount: number,
	): Promise<OrderedDataStoreEntry> {
		return this.client.request<OrderedDataStoreEntry>(
			'POST',
			`${this.basePath(universeId, dataStoreId, scopeId)}/${encodeURIComponent(entryId)}:increment`,
			{ body: { amount } },
		);
	}
}
