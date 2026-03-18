import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export type DataStoreGroupType = 'standard' | 'ordered';

export class DataStoreGroupNode extends BaseNode {
	readonly contextValue = 'dataStoreGroup';

	constructor(
		profile: UniverseConfig,
		public readonly groupType: DataStoreGroupType,
	) {
		super(
			profile,
			groupType === 'standard' ? 'Standard Data Stores' : 'Ordered Data Stores',
			vscode.TreeItemCollapsibleState.Collapsed,
		);
		this.iconPath = new vscode.ThemeIcon(groupType === 'standard' ? 'database' : 'list-ordered');
	}

	// Children are loaded by the DataStoreTreeProvider, not here,
	// because it needs the API client which the node doesn't hold.
	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
