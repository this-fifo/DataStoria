import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { URI_SCHEME_ENTRY } from '../../constants';
import { encodeEntryUri } from '../../documents/uriHelper';
import { BaseNode } from './baseNode';

export class EntryNode extends BaseNode {
	readonly contextValue = 'entry';

	constructor(
		profile: UniverseConfig,
		public readonly dataStoreId: string,
		public readonly scope: string,
		public readonly entryId: string,
	) {
		// Collapsed — click the arrow to load revision history
		super(profile, entryId, vscode.TreeItemCollapsibleState.Collapsed);
		this.iconPath = new vscode.ThemeIcon('symbol-key');
		this.tooltip = new vscode.MarkdownString(
			[
				`**Key:** \`${entryId}\``,
				`**Scope:** ${scope}`,
				`**Data Store:** ${dataStoreId}`,
				'',
				'Expand to see revision history',
				'',
				'---',
				'*Max value size: 4 MB · Key name limit: 50 chars*',
			].join('\n'),
		);

		// Click the label to view entry value
		this.command = {
			command: 'datastoria.viewEntry',
			title: 'View Entry Value',
			arguments: [this],
		};
	}

	getUri(revisionId?: string): vscode.Uri {
		return encodeEntryUri({
			scheme: URI_SCHEME_ENTRY,
			universeId: this.profile.universeId,
			dataStoreId: this.dataStoreId,
			scope: this.scope,
			entryId: this.entryId,
			revisionId,
		});
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
