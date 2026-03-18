import * as vscode from 'vscode';
import type { Revision, UniverseConfig } from '../../api/types';
import { URI_SCHEME_REVISION } from '../../constants';
import { encodeEntryUri } from '../../documents/uriHelper';
import { BaseNode } from './baseNode';

export class RevisionNode extends BaseNode {
	readonly contextValue = 'revision';

	constructor(
		profile: UniverseConfig,
		public readonly dataStoreId: string,
		public readonly scope: string,
		public readonly entryId: string,
		public readonly revision: Revision,
		public readonly isCurrent: boolean,
	) {
		const date = new Date(revision.revisionCreateTime);
		const shortId = revision.revisionId.slice(0, 8);

		// Current: bold label, past: subtle
		const label = isCurrent ? `${shortId}  current` : shortId;

		super(profile, label, vscode.TreeItemCollapsibleState.None);

		this.description = formatRelativeDate(date);
		this.iconPath = new vscode.ThemeIcon(
			revision.state === 'DELETED' ? 'trash' : isCurrent ? 'pass-filled' : 'git-commit',
			isCurrent ? new vscode.ThemeColor('testing.iconPassed') : undefined,
		);
		const tooltipLines = [
			isCurrent ? '**Current version**' : '**Past revision**',
			`**Revision:** \`${revision.revisionId}\``,
			`**Date:** ${date.toLocaleString()}`,
			`**State:** ${revision.state}`,
		];

		if (!isCurrent) {
			const daysOld = Math.floor((Date.now() - date.getTime()) / 86_400_000);
			const daysLeft = 30 - daysOld;
			if (daysLeft > 0) {
				tooltipLines.push(`**Retention:** ~${daysLeft}d remaining (expires after 30d)`);
			} else {
				tooltipLines.push('**Retention:** $(warning) may expire soon');
			}
			tooltipLines.push('', 'Click to view · Right-click to restore');
		} else {
			tooltipLines.push('', '*Latest version never expires*');
		}

		this.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));

		this.command = {
			command: 'datastoria.viewEntry',
			title: 'View Revision Value',
			arguments: [this],
		};
	}

	getUri(): vscode.Uri {
		return encodeEntryUri({
			scheme: URI_SCHEME_REVISION,
			universeId: this.profile.universeId,
			dataStoreId: this.dataStoreId,
			scope: this.scope,
			entryId: this.entryId,
			revisionId: this.revision.revisionId,
		});
	}

	async getChildren(): Promise<BaseNode[]> {
		return [];
	}
}

function formatRelativeDate(date: Date): string {
	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffMin = Math.floor(diffMs / 60_000);
	const diffHour = Math.floor(diffMs / 3_600_000);
	const diffDay = Math.floor(diffMs / 86_400_000);

	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHour < 24) return `${diffHour}h ago`;
	if (diffDay < 30) return `${diffDay}d ago`;
	return date.toLocaleDateString();
}
