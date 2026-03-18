import * as vscode from 'vscode';
import { RobloxApiError } from '../api/client';

export class ErrorHandler {
	handle(error: unknown, context: string): void {
		if (error instanceof RobloxApiError) {
			switch (error.code) {
				case 'RESOURCE_EXHAUSTED':
					vscode.window.showWarningMessage(
						`DataStoria: Rate limited while ${context}. The per-key throughput is 25 MB/min (read) and 4 MB/min (write). Retrying automatically...`,
					);
					break;
				case 'NOT_FOUND':
					vscode.window.showWarningMessage(
						`DataStoria: Not found while ${context}. The resource may have been deleted or the revision may have expired (versions expire after 30 days).`,
					);
					break;
				case 'PERMISSION_DENIED':
					vscode.window
						.showErrorMessage(
							`DataStoria: Permission denied while ${context}. Check your API key has the required Open Cloud v2 scopes.`,
							'Open Cloud API Keys',
						)
						.then((action) => {
							if (action === 'Open Cloud API Keys') {
								vscode.env.openExternal(
									vscode.Uri.parse('https://create.roblox.com/docs/cloud/open-cloud/api-keys'),
								);
							}
						});
					break;
				case 'INVALID_ARGUMENT':
					vscode.window.showErrorMessage(
						`DataStoria: Invalid request while ${context}: ${error.message}. Note: key, scope, and data store names are limited to 50 characters; values to 4 MB.`,
					);
					break;
				case 'ALREADY_EXISTS':
					vscode.window.showErrorMessage(
						`DataStoria: Entry already exists while ${context}. Use edit to update an existing entry.`,
					);
					break;
				case 'FAILED_PRECONDITION':
					vscode.window.showErrorMessage(
						`DataStoria: Precondition failed while ${context}. The entry may have been modified by another client (ETag mismatch).`,
					);
					break;
				case 'ABORTED':
					vscode.window.showWarningMessage(
						`DataStoria: Conflict while ${context}. The entry was modified concurrently. Try again.`,
					);
					break;
				case 'UNAVAILABLE':
					vscode.window.showWarningMessage(
						`DataStoria: Service temporarily unavailable while ${context}. Retrying...`,
					);
					break;
				case 'INTERNAL':
					vscode.window.showErrorMessage(
						`DataStoria: Roblox internal error while ${context}. This is usually temporary — try again shortly.`,
					);
					break;
				default:
					vscode.window.showErrorMessage(`DataStoria: Error ${context}: ${error.message}`);
			}
		} else {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(
				`DataStoria: Connection error while ${context}. Check your network and API key. ${message}`,
			);
		}
	}
}
