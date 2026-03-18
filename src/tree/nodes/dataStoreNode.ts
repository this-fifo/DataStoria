import * as vscode from 'vscode';
import type { DataStore, UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export class DataStoreNode extends BaseNode {
	readonly contextValue: string;

	constructor(
		profile: UniverseConfig,
		public readonly dataStore: DataStore,
	) {
		super(profile, dataStore.id, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = dataStore.deleteTime ? 'dataStore.deleted' : 'dataStore';
		this.iconPath = new vscode.ThemeIcon(dataStore.deleteTime ? 'trash' : 'database');

		const tooltipLines = [
			`**Data Store:** \`${dataStore.id}\``,
			`**Created:** ${new Date(dataStore.createTime).toLocaleString()}`,
		];
		if (dataStore.deleteTime) {
			this.description = 'deleted';
			tooltipLines.push(`**Deleted:** ${new Date(dataStore.deleteTime).toLocaleString()}`);
			tooltipLines.push('', '*Deletion takes up to 30 days to process*');
		}
		tooltipLines.push(
			'',
			'---',
			'*Name limit: 50 chars · Key limit: 50 chars · Scope limit: 50 chars*',
			'*Max value: 4 MB/key · Read: 25 MB/min/key · Write: 4 MB/min/key*',
		);
		this.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
