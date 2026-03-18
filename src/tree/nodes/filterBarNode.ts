import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export class FilterBarNode extends BaseNode {
	readonly contextValue = 'filterBar';

	constructor(
		profile: UniverseConfig,
		public readonly dataStoreId: string,
		public readonly scopeId: string,
		public readonly filter: string,
		public readonly resultCount: number,
	) {
		super(
			profile,
			`${resultCount} result${resultCount !== 1 ? 's' : ''} for "${filter}"`,
			vscode.TreeItemCollapsibleState.None,
		);
		this.iconPath = new vscode.ThemeIcon('filter');
		this.description = 'click to clear';
		this.tooltip = `Filtering by: id.startsWith("${filter}")\nClick to clear filter`;

		this.command = {
			command: 'datastoria.clearFilter',
			title: 'Clear Filter',
			arguments: [this],
		};
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
