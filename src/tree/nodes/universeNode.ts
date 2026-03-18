import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';
import { DataStoreGroupNode } from './dataStoreGroupNode';

export class UniverseNode extends BaseNode {
	readonly contextValue = 'universe';

	constructor(profile: UniverseConfig) {
		super(profile, profile.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.description = `Universe ${profile.universeId}`;
		this.iconPath = new vscode.ThemeIcon('globe');
		this.tooltip = `${profile.name}\nUniverse ID: ${profile.universeId}`;
	}

	async getChildren(): Promise<BaseNode[]> {
		return [
			new DataStoreGroupNode(this.profile, 'standard'),
			new DataStoreGroupNode(this.profile, 'ordered'),
		];
	}
}
