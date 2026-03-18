import * as vscode from 'vscode';
import type { UniverseConfig } from '../../api/types';
import { BaseNode } from './baseNode';

export class ErrorNode extends BaseNode {
	readonly contextValue = 'error';

	constructor(profile: UniverseConfig, error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		super(profile, message, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon('error');
		this.tooltip = `Error: ${message}`;
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}
