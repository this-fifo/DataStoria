import * as vscode from 'vscode';
import type { RobloxApiClient } from '../api/client';
import { EntriesService } from '../api/entries';
import type { UniverseConfig } from '../api/types';
import type { ProfileManager } from '../auth/profiles';
import { decodeEntryUri } from './uriHelper';

export type ApiClientFactory = (profile: UniverseConfig) => RobloxApiClient;

export class EntryDocumentProvider implements vscode.TextDocumentContentProvider {
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this._onDidChange.event;

	constructor(
		private readonly clientFactory: ApiClientFactory,
		private readonly profileManager: ProfileManager,
	) {}

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const params = decodeEntryUri(uri);
		const profile = this.profileManager
			.getUniverses()
			.find((p) => p.universeId === params.universeId);

		if (!profile) {
			return `// Error: No universe found for ID ${params.universeId}`;
		}

		const client = this.clientFactory(profile);
		const entries = new EntriesService(client);

		const indent = vscode.workspace.getConfiguration('datastoria').get<number>('jsonIndent', 2);

		const entry = await entries.get(params.universeId, params.dataStoreId, params.entryId, {
			scope: params.scope,
			revisionId: params.revisionId,
		});

		return JSON.stringify(entry.value, null, indent);
	}

	refresh(uri: vscode.Uri): void {
		this._onDidChange.fire(uri);
	}
}
