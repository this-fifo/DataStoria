import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export class ScopeNode extends BaseNode {
	readonly contextValue = 'scope';

	constructor(
		profile: UniverseConfig,
		public readonly dataStoreId: string,
		public readonly scopeId: string,
		expanded = false,
	) {
		super(
			profile,
			scopeId,
			expanded
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.Collapsed,
		);
		this.iconPath = new vscode.ThemeIcon('symbol-namespace');
		this.tooltip = `Scope: ${scopeId}\nData Store: ${dataStoreId}`;
	}

	setFilterActive(active: boolean): void {
		this.iconPath = new vscode.ThemeIcon(active ? 'filter-filled' : 'symbol-namespace');
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
