import * as vscode from 'vscode';
import { LIMIT_VALUE_BYTES, URI_SCHEME_ENTRY, URI_SCHEME_REVISION } from '../constants';
import { decodeEntryUri } from './uriHelper';

export class RevisionCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const { scheme } = document.uri;
		if (scheme !== URI_SCHEME_ENTRY && scheme !== URI_SCHEME_REVISION) {
			return [];
		}

		const params = decodeEntryUri(document.uri);
		const range = new vscode.Range(0, 0, 0, 0);
		const lenses: vscode.CodeLens[] = [];

		// Size indicator
		const sizeBytes = Buffer.byteLength(document.getText(), 'utf8');
		const sizeLabel = formatSize(sizeBytes);
		const pct = ((sizeBytes / LIMIT_VALUE_BYTES) * 100).toFixed(1);
		const sizeIcon = sizeBytes > LIMIT_VALUE_BYTES * 0.9 ? '$(warning)' : '$(file-binary)';
		lenses.push(
			new vscode.CodeLens(range, {
				title: `${sizeIcon} ${sizeLabel} / 4 MB (${pct}%)`,
				command: '',
			}),
		);

		if (params.revisionId) {
			const shortRev = params.revisionId.slice(0, 8);

			lenses.push(
				new vscode.CodeLens(range, {
					title: `$(git-commit) Revision ${shortRev}`,
					command: '',
				}),
			);

			lenses.push(
				new vscode.CodeLens(range, {
					title: '$(debug-reverse-continue) Restore this version',
					command: 'datastoria.restoreFromEditor',
					arguments: [params],
				}),
			);

			lenses.push(
				new vscode.CodeLens(range, {
					title: '$(diff) Compare with current',
					command: 'datastoria.diffFromEditor',
					arguments: [params],
				}),
			);
		} else {
			lenses.push(
				new vscode.CodeLens(range, {
					title: '$(pass-filled) Current version',
					command: '',
				}),
			);
		}

		return lenses;
	}
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
