import type { RobloxApiClient } from './client';
import type { DataStore, ListDataStoresResponse } from './types';

export class DataStoresService {
	constructor(private readonly client: RobloxApiClient) {}

	async list(
		universeId: string,
		opts?: {
			maxPageSize?: number;
			pageToken?: string;
			filter?: string;
			showDeleted?: boolean;
		},
	): Promise<ListDataStoresResponse> {
		return this.client.request<ListDataStoresResponse>(
			'GET',
			`/universes/${universeId}/data-stores`,
			{
				query: {
					maxPageSize: opts?.maxPageSize,
					pageToken: opts?.pageToken,
					filter: opts?.filter,
					showDeleted: opts?.showDeleted,
				},
			},
		);
	}

	async delete(universeId: string, dataStoreId: string): Promise<DataStore> {
		return this.client.request<DataStore>(
			'DELETE',
			`/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}`,
		);
	}

	async undelete(universeId: string, dataStoreId: string): Promise<DataStore> {
		return this.client.request<DataStore>(
			'POST',
			`/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}:undelete`,
			{ body: {} },
		);
	}

	async snapshot(universeId: string): Promise<void> {
		await this.client.request('POST', `/universes/${universeId}/data-stores:snapshot`, {
			body: {},
		});
	}
}
