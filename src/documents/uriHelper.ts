import * as vscode from 'vscode';

export interface EntryUriParams {
	scheme: string;
	universeId: string;
	dataStoreId: string;
	scope: string;
	entryId: string;
	revisionId?: string;
}

export function encodeEntryUri(params: EntryUriParams): vscode.Uri {
	// Build a filename that reads well in the editor tab
	let filename: string;
	if (params.revisionId) {
		filename = `${params.entryId} @ ${params.revisionId.slice(0, 8)}.json`;
	} else {
		filename = `${params.entryId}.json`;
	}

	const pathSegments = [params.universeId, params.dataStoreId, params.scope, filename]
		.map(encodeURIComponent)
		.join('/');

	const query = params.revisionId ? `rev=${encodeURIComponent(params.revisionId)}` : '';

	return vscode.Uri.parse(`${params.scheme}:///${pathSegments}${query ? `?${query}` : ''}`);
}

export function decodeEntryUri(uri: vscode.Uri): EntryUriParams {
	const segments = uri.path.split('/').filter(Boolean).map(decodeURIComponent);
	const params = new URLSearchParams(uri.query);

	// Strip .json and optional " @ revshort" from the filename to get the entry ID
	let entryId = segments[3] || '';
	entryId = entryId.replace(/\.json$/, '').replace(/ @ [a-f0-9]+$/i, '');

	return {
		scheme: uri.scheme,
		universeId: segments[0],
		dataStoreId: segments[1],
		scope: segments[2],
		entryId,
		revisionId: params.get('rev') ?? undefined,
	};
}

export function entryUriLabel(uri: vscode.Uri): string {
	const params = decodeEntryUri(uri);
	const rev = params.revisionId ? ` @ ${params.revisionId.slice(0, 8)}` : '';
	return `${params.entryId}${rev}`;
}
