import type { RobloxApiClient } from './client';
import type { ListRevisionsResponse } from './types';

export class RevisionsService {
	constructor(private readonly client: RobloxApiClient) {}

	async list(
		universeId: string,
		dataStoreId: string,
		entryId: string,
		opts?: {
			scope?: string;
			maxPageSize?: number;
			pageToken?: string;
			filter?: string;
		},
	): Promise<ListRevisionsResponse> {
		const scope = opts?.scope;
		const basePath = scope
			? `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/scopes/${encodeURIComponent(scope)}/entries/${encodeURIComponent(entryId)}:listRevisions`
			: `/universes/${universeId}/data-stores/${encodeURIComponent(dataStoreId)}/entries/${encodeURIComponent(entryId)}:listRevisions`;

		return this.client.request<ListRevisionsResponse>('GET', basePath, {
			query: {
				maxPageSize: opts?.maxPageSize,
				pageToken: opts?.pageToken,
				filter: opts?.filter,
			},
		});
	}
}
