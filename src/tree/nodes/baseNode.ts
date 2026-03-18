import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';

export abstract class BaseNode extends vscode.TreeItem {
	abstract readonly contextValue: string;

	constructor(
		public readonly profile: UniverseConfig,
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState,
	) {
		super(label, collapsibleState);
	}

	abstract getChildren(): Promise<BaseNode[]>;
}
