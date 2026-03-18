import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export class LoadMoreNode extends BaseNode {
	readonly contextValue = 'loadMore';

	constructor(
		profile: UniverseConfig,
		public readonly parentNode: BaseNode,
		public readonly nextPageToken: string,
	) {
		super(profile, 'Load More...', vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon('ellipsis');
		this.command = {
			command: 'datastoria.loadMore',
			title: 'Load More',
			arguments: [this],
		};
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
