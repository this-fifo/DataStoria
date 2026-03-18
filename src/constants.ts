export const API_BASE_URL = 'https://apis.roblox.com/cloud/v2';

export const URI_SCHEME_ENTRY = 'datastoria-entry';
export const URI_SCHEME_ORDERED = 'datastoria-ordered';
export const URI_SCHEME_REVISION = 'datastoria-revision';

export const SECRET_KEY_PREFIX = 'datastoria.apiKey.';

export const VIEW_ID = 'datastoria.explorer';

// ── Roblox Data Store Limits ──
// https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits

/** Max characters for a data store name */
export const LIMIT_DATASTORE_NAME = 50;
/** Max characters for an entry key name */
export const LIMIT_KEY_NAME = 50;
/** Max characters for a scope name */
export const LIMIT_SCOPE_NAME = 50;
/** Max entry value size in bytes (4 MB) */
export const LIMIT_VALUE_BYTES = 4_194_304;
/** Max metadata attribute key name length */
export const LIMIT_METADATA_KEY = 50;
/** Max metadata attribute value length */
export const LIMIT_METADATA_VALUE = 250;
/** Max total metadata key-value pairs size */
export const LIMIT_METADATA_TOTAL = 300;
/** Per-key read throughput limit (bytes/min) */
export const LIMIT_KEY_READ_THROUGHPUT = 25 * 1024 * 1024;
/** Per-key write throughput limit (bytes/min) */
export const LIMIT_KEY_WRITE_THROUGHPUT = 4 * 1024 * 1024;
/** Versioned backups expire after this many days */
export const REVISION_RETENTION_DAYS = 30;
/** Cache duration for GetAsync in seconds */
export const CACHE_DURATION_SECONDS = 4;
