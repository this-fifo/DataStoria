// Named API key credential. The actual key lives in SecretStorage.
export interface ApiKeyConfig {
	name: string;
}

// Universe configuration that references an API key by name.
export interface UniverseConfig {
	name: string;
	universeId: string;
	apiKeyName: string;
}

// Standard Data Store
export interface DataStore {
	path: string;
	id: string;
	createTime: string;
	deleteTime?: string;
}

export interface ListDataStoresResponse {
	dataStores: DataStore[];
	nextPageToken?: string;
}

// Data Store Entry
export interface DataStoreEntry {
	path: string;
	id: string;
	value: unknown;
	createTime: string;
	updateTime: string;
	revisionId: string;
	revisionCreateTime: string;
	etag: string;
	state?: 'ACTIVE' | 'DELETED';
	attributes?: Record<string, unknown>;
	users?: string[];
}

export interface ListEntriesResponse {
	dataStoreEntries: DataStoreEntry[];
	nextPageToken?: string;
}

// Revision (partial entry returned by listRevisions)
export interface Revision {
	path: string;
	id: string;
	createTime: string;
	revisionCreateTime: string;
	revisionId: string;
	etag: string;
	state: 'ACTIVE' | 'DELETED';
}

export interface ListRevisionsResponse {
	dataStoreEntries: Revision[];
	nextPageToken?: string;
}

// Ordered Data Store Entry
export interface OrderedDataStoreEntry {
	path: string;
	id: string;
	value: number;
	createTime: string;
	updateTime: string;
}

export interface ListOrderedEntriesResponse {
	orderedDataStoreEntries: OrderedDataStoreEntry[];
	nextPageToken?: string;
}

// API Error shape from Roblox
export interface RobloxErrorDetail {
	code: string;
	message: string;
	details?: unknown[];
}

// Rate limit tracking
export interface RateLimitState {
	remaining: number;
	limit: number;
	percentUsed: number;
}
