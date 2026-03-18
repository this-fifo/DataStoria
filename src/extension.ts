import * as vscode from 'vscode';
import { RobloxApiClient } from './api/client';
import { EntriesService } from './api/entries';
import { RevisionsService } from './api/revisions';
import type { UniverseConfig } from './api/types';
import {
	showAddApiKeyWizard,
	showAddUniverseWizard,
	showDeleteApiKeyWizard,
	showEditApiKeyWizard,
	showEditUniverseWizard,
} from './auth/profilePicker';
import { ProfileManager } from './auth/profiles';
import { ApiKeyStorage } from './auth/secretStorage';
import {
	LIMIT_KEY_NAME,
	LIMIT_SCOPE_NAME,
	LIMIT_VALUE_BYTES,
	URI_SCHEME_ENTRY,
	URI_SCHEME_ORDERED,
	URI_SCHEME_REVISION,
} from './constants';
import { EntryDocumentProvider } from './documents/entryDocumentProvider';
import { RevisionCodeLensProvider } from './documents/revisionCodeLensProvider';
import { type EntryUriParams, encodeEntryUri } from './documents/uriHelper';
import { ErrorHandler } from './errors/errorHandler';
import { SearchViewProvider } from './search/searchViewProvider';
import { ConnectionStatusBar } from './status/connectionStatusBar';
import { Logger } from './telemetry/logger';
import { DataStoreTreeProvider } from './tree/dataStoreTreeProvider';
import type { DataStoreNode } from './tree/nodes/dataStoreNode';
import type { EntryNode } from './tree/nodes/entryNode';
import type { LoadMoreNode } from './tree/nodes/loadMoreNode';
import { RevisionNode } from './tree/nodes/revisionNode';
import type { ScopeNode } from './tree/nodes/scopeNode';
import type { UniverseNode } from './tree/nodes/universeNode';

export function activate(context: vscode.ExtensionContext) {
	const logger = new Logger('DataStoria');
	const keyStorage = new ApiKeyStorage(context.secrets);
	const profileManager = new ProfileManager(keyStorage);
	const errorHandler = new ErrorHandler();

	const createClient = (universe: UniverseConfig) =>
		new RobloxApiClient({
			getApiKey: () => profileManager.getSecretForUniverse(universe.name),
		});

	// Tree view
	const treeProvider = new DataStoreTreeProvider(profileManager, createClient);
	const treeView = vscode.window.createTreeView('datastoria.explorer', {
		treeDataProvider: treeProvider,
		showCollapseAll: true,
	});

	// Document providers
	const entryDocProvider = new EntryDocumentProvider(createClient, profileManager);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(URI_SCHEME_ENTRY, entryDocProvider),
		vscode.workspace.registerTextDocumentContentProvider(URI_SCHEME_REVISION, entryDocProvider),
		vscode.workspace.registerTextDocumentContentProvider(URI_SCHEME_ORDERED, entryDocProvider),
	);

	// Status bar
	const statusBar = new ConnectionStatusBar(profileManager);

	// Search panel (retainContextWhenHidden keeps text input state when clicking away)
	const searchProvider = new SearchViewProvider(treeProvider);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SearchViewProvider.viewId, searchProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	);

	// CodeLens: shows "Current version" or "Revision xxx · Restore" in the editor
	const codeLensProvider = new RevisionCodeLensProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			[
				{ scheme: URI_SCHEME_ENTRY, language: 'json' },
				{ scheme: URI_SCHEME_REVISION, language: 'json' },
				{ scheme: URI_SCHEME_ENTRY },
				{ scheme: URI_SCHEME_REVISION },
			],
			codeLensProvider,
		),
	);

	// Track tree selection to update search context
	treeView.onDidChangeSelection((e) => {
		const node = e.selection[0];
		if (!node) return;

		const n = node as unknown as {
			profile?: UniverseConfig;
			dataStoreId?: string;
			dataStore?: { id: string };
			scopeId?: string;
			scope?: string;
		};

		if (!n.profile) return;

		const dataStoreId = n.dataStoreId || n.dataStore?.id;
		const scopeId = n.scopeId || n.scope;

		if (dataStoreId && scopeId) {
			searchProvider.setContext({ profile: n.profile, dataStoreId, scopeId });
		} else if (dataStoreId) {
			// DataStoreNode selected without scope — default to global
			searchProvider.setContext({ profile: n.profile, dataStoreId, scopeId: 'global' });
		}
	});

	// Refresh tree when profiles change
	profileManager.onDidChange(() => treeProvider.refresh());

	// === Commands ===

	// API key and universe management
	context.subscriptions.push(
		vscode.commands.registerCommand('datastoria.addApiKey', () =>
			showAddApiKeyWizard(profileManager),
		),

		vscode.commands.registerCommand('datastoria.addUniverse', () =>
			showAddUniverseWizard(profileManager),
		),

		vscode.commands.registerCommand('datastoria.editApiKey', () =>
			showEditApiKeyWizard(profileManager),
		),

		vscode.commands.registerCommand('datastoria.deleteApiKey', () =>
			showDeleteApiKeyWizard(profileManager),
		),

		vscode.commands.registerCommand('datastoria.editProfile', async (node?: UniverseNode) => {
			if (!node) return;
			await showEditUniverseWizard(profileManager, node.profile);
		}),

		vscode.commands.registerCommand('datastoria.deleteProfile', async (node?: UniverseNode) => {
			if (!node) return;
			const confirm = await vscode.window.showWarningMessage(
				`Remove universe "${node.profile.name}"?`,
				{ modal: true },
				'Remove',
			);
			if (confirm === 'Remove') {
				await profileManager.deleteUniverse(node.profile.name);
			}
		}),
	);

	// Tree operations
	context.subscriptions.push(
		vscode.commands.registerCommand('datastoria.refresh', () => treeProvider.refresh()),

		vscode.commands.registerCommand('datastoria.loadMore', async (node?: LoadMoreNode) => {
			if (!node) return;
			try {
				await treeProvider.loadMoreChildren(node);
			} catch (error) {
				errorHandler.handle(error, 'loading more items');
			}
		}),

		vscode.commands.registerCommand('datastoria.browseScope', async (node?: DataStoreNode) => {
			if (!node) return;
			const scope = await vscode.window.showInputBox({
				prompt: `Enter scope name to browse (max ${LIMIT_SCOPE_NAME} chars)`,
				placeHolder: 'e.g., guild, session, global',
				validateInput: (v: string) => {
					if (!v.trim()) return 'Scope name is required';
					if (v.length > LIMIT_SCOPE_NAME)
						return `Scope name must be ${LIMIT_SCOPE_NAME} characters or fewer (${v.length}/${LIMIT_SCOPE_NAME})`;
					return undefined;
				},
			});
			if (!scope) return;
			treeProvider.addCustomScope(node, scope);
		}),

		vscode.commands.registerCommand(
			'datastoria.searchEntries',
			async (node?: DataStoreNode | ScopeNode) => {
				if (!node) return;

				const targetNode = node as unknown as {
					profile: UniverseConfig;
					dataStoreId?: string;
					dataStore?: { id: string };
					scopeId?: string;
				};
				const dataStoreId = targetNode.dataStoreId || targetNode.dataStore?.id;
				if (!dataStoreId) return;

				const scope = targetNode.scopeId || 'global';

				searchProvider.setContext({
					profile: targetNode.profile,
					dataStoreId,
					scopeId: scope,
				});
				searchProvider.focus();
			},
		),

		vscode.commands.registerCommand(
			'datastoria.clearFilter',
			(node?: { profile: UniverseConfig; dataStoreId: string; scopeId: string }) => {
				if (!node) return;
				treeProvider.clearFilter(node.profile.universeId, node.dataStoreId, node.scopeId);
			},
		),
	);

	// Entry operations
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'datastoria.viewEntry',
			async (node?: EntryNode | RevisionNode) => {
				if (!node) return;
				try {
					let uri: vscode.Uri;
					if (node instanceof RevisionNode) {
						uri = node.getUri();
					} else {
						uri = node.getUri();
					}
					const doc = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(doc, {
						preview: true,
						preserveFocus: false,
					});
				} catch (error) {
					errorHandler.handle(error, 'viewing entry');
				}
			},
		),

		vscode.commands.registerCommand('datastoria.editEntry', async (node?: EntryNode) => {
			if (!node) return;
			try {
				const client = createClient(node.profile);
				const entries = new EntriesService(client);
				const entry = await entries.get(node.profile.universeId, node.dataStoreId, node.entryId, {
					scope: node.scope,
				});

				const indent = vscode.workspace.getConfiguration('datastoria').get<number>('jsonIndent', 2);
				const content = JSON.stringify(entry.value, null, indent);

				const doc = await vscode.workspace.openTextDocument({
					content,
					language: 'json',
				});
				await vscode.window.showTextDocument(doc);

				// Listen for save to push the update
				const saveListener = vscode.workspace.onWillSaveTextDocument(async (e) => {
					if (e.document !== doc) return;

					const text = e.document.getText();
					let parsed: unknown;
					try {
						parsed = JSON.parse(text);
					} catch {
						vscode.window.showErrorMessage(
							'DataStoria: Invalid JSON. Fix the syntax and save again.',
						);
						return;
					}

					const sizeBytes = Buffer.byteLength(text, 'utf8');
					if (sizeBytes > LIMIT_VALUE_BYTES) {
						const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
						vscode.window.showErrorMessage(
							`DataStoria: Value is ${sizeMB} MB — exceeds the 4 MB limit. Reduce the data size.`,
						);
						return;
					}
					if (sizeBytes > LIMIT_VALUE_BYTES * 0.9) {
						const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
						vscode.window.showWarningMessage(
							`DataStoria: Value is ${sizeMB} MB — approaching the 4 MB limit.`,
						);
					}

					const shouldConfirm = vscode.workspace
						.getConfiguration('datastoria')
						.get<boolean>('confirmDestructiveActions', true);

					if (shouldConfirm) {
						const confirm = await vscode.window.showWarningMessage(
							`Update entry "${node.entryId}"? This creates a new revision.`,
							{ modal: true },
							'Update',
						);
						if (confirm !== 'Update') return;
					}

					try {
						await entries.update(node.profile.universeId, node.dataStoreId, node.entryId, parsed, {
							scope: node.scope,
						});
						vscode.window.showInformationMessage(`DataStoria: Entry "${node.entryId}" updated`);
						treeProvider.refresh();
						saveListener.dispose();
					} catch (error) {
						errorHandler.handle(error, 'updating entry');
					}
				});

				context.subscriptions.push(saveListener);
			} catch (error) {
				errorHandler.handle(error, 'loading entry for edit');
			}
		}),

		vscode.commands.registerCommand('datastoria.createEntry', async (node?: EntryNode) => {
			// This command can be triggered from DataStoreNode or ScopeNode
			// We'll handle the generic case
			const targetNode = node as unknown as {
				profile: UniverseConfig;
				dataStoreId?: string;
				dataStore?: { id: string };
				scopeId?: string;
				scope?: string;
			};
			if (!targetNode?.profile) return;

			const dataStoreId = targetNode.dataStoreId || targetNode.dataStore?.id;
			if (!dataStoreId) return;

			const entryId = await vscode.window.showInputBox({
				prompt: `Entry ID (key name, max ${LIMIT_KEY_NAME} chars)`,
				placeHolder: 'e.g., player_12345',
				validateInput: (v: string) => {
					if (!v.trim()) return 'Entry ID is required';
					if (v.length > LIMIT_KEY_NAME)
						return `Entry ID must be ${LIMIT_KEY_NAME} characters or fewer (${v.length}/${LIMIT_KEY_NAME})`;
					return undefined;
				},
			});
			if (!entryId) return;

			const valueStr = await vscode.window.showInputBox({
				prompt: 'Entry value (JSON, max 4 MB)',
				placeHolder: '{"coins": 100, "level": 1}',
				validateInput: (v: string) => {
					try {
						JSON.parse(v);
					} catch {
						return 'Invalid JSON';
					}
					const size = Buffer.byteLength(v, 'utf8');
					if (size > LIMIT_VALUE_BYTES) {
						return `Value exceeds 4 MB limit (${(size / (1024 * 1024)).toFixed(2)} MB)`;
					}
					return undefined;
				},
			});
			if (!valueStr) return;

			try {
				const client = createClient(targetNode.profile);
				const entries = new EntriesService(client);
				const scope = targetNode.scopeId || targetNode.scope || 'global';
				await entries.create(
					targetNode.profile.universeId,
					dataStoreId,
					entryId,
					JSON.parse(valueStr),
					{ scope },
				);
				vscode.window.showInformationMessage(`DataStoria: Entry "${entryId}" created`);
				treeProvider.refresh();
			} catch (error) {
				errorHandler.handle(error, 'creating entry');
			}
		}),

		vscode.commands.registerCommand('datastoria.deleteEntry', async (node?: EntryNode) => {
			if (!node) return;

			const shouldConfirm = vscode.workspace
				.getConfiguration('datastoria')
				.get<boolean>('confirmDestructiveActions', true);

			if (shouldConfirm) {
				const confirm = await vscode.window.showWarningMessage(
					`Delete entry "${node.entryId}"? It will be permanently removed after 30 days.`,
					{ modal: true },
					'Delete',
				);
				if (confirm !== 'Delete') return;
			}

			try {
				const client = createClient(node.profile);
				const entries = new EntriesService(client);
				await entries.delete(node.profile.universeId, node.dataStoreId, node.entryId, {
					scope: node.scope,
				});
				vscode.window.showInformationMessage(`DataStoria: Entry "${node.entryId}" deleted`);
				treeProvider.refresh();
			} catch (error) {
				errorHandler.handle(error, 'deleting entry');
			}
		}),

		vscode.commands.registerCommand('datastoria.incrementEntry', async (node?: EntryNode) => {
			if (!node) return;

			const amountStr = await vscode.window.showInputBox({
				prompt: 'Increment amount (integer)',
				placeHolder: '1',
				value: '1',
				validateInput: (v: string) => {
					const num = Number(v);
					if (!Number.isInteger(num)) return 'Must be an integer';
					return undefined;
				},
			});
			if (!amountStr) return;

			try {
				const client = createClient(node.profile);
				const entries = new EntriesService(client);
				const result = await entries.increment(
					node.profile.universeId,
					node.dataStoreId,
					node.entryId,
					Number(amountStr),
					{ scope: node.scope },
				);
				vscode.window.showInformationMessage(
					`DataStoria: Entry "${node.entryId}" incremented. New value: ${JSON.stringify(result.value)}`,
				);
				treeProvider.refresh();
			} catch (error) {
				errorHandler.handle(error, 'incrementing entry');
			}
		}),

		vscode.commands.registerCommand('datastoria.copyEntryId', async (node?: EntryNode) => {
			if (!node) return;
			await vscode.env.clipboard.writeText(node.entryId);
			vscode.window.showInformationMessage('DataStoria: Entry ID copied to clipboard');
		}),

		vscode.commands.registerCommand('datastoria.copyEntryValue', async (node?: EntryNode) => {
			if (!node) return;
			try {
				const client = createClient(node.profile);
				const entries = new EntriesService(client);
				const entry = await entries.get(node.profile.universeId, node.dataStoreId, node.entryId, {
					scope: node.scope,
				});
				const indent = vscode.workspace.getConfiguration('datastoria').get<number>('jsonIndent', 2);
				await vscode.env.clipboard.writeText(JSON.stringify(entry.value, null, indent));
				vscode.window.showInformationMessage('DataStoria: Entry value copied to clipboard');
			} catch (error) {
				errorHandler.handle(error, 'copying entry value');
			}
		}),
	);

	// Revision / Time-travel commands
	context.subscriptions.push(
		vscode.commands.registerCommand('datastoria.viewRevisions', async (node?: EntryNode) => {
			if (!node) return;
			// Change the entry to expandable and refresh
			node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
			treeProvider.refresh(node);
		}),

		vscode.commands.registerCommand('datastoria.diffWithCurrent', async (node?: RevisionNode) => {
			if (!node || node.isCurrent) return;

			try {
				const currentUri = encodeEntryUri({
					scheme: URI_SCHEME_ENTRY,
					universeId: node.profile.universeId,
					dataStoreId: node.dataStoreId,
					scope: node.scope,
					entryId: node.entryId,
				});
				const revisionUri = node.getUri();

				await vscode.commands.executeCommand(
					'vscode.diff',
					revisionUri,
					currentUri,
					`${node.entryId}: ${node.revision.revisionId.slice(0, 8)} ↔ Current`,
				);
			} catch (error) {
				errorHandler.handle(error, 'comparing revisions');
			}
		}),

		vscode.commands.registerCommand('datastoria.restoreRevision', async (node?: RevisionNode) => {
			if (!node) return;

			const confirm = await vscode.window.showWarningMessage(
				`Restore revision ${node.revision.revisionId.slice(0, 8)}? This creates a new revision with that value.`,
				{ modal: true },
				'Restore',
			);
			if (confirm !== 'Restore') return;

			try {
				const client = createClient(node.profile);
				const entries = new EntriesService(client);

				// Fetch the old revision's value
				const oldEntry = await entries.get(
					node.profile.universeId,
					node.dataStoreId,
					node.entryId,
					{
						scope: node.scope,
						revisionId: node.revision.revisionId,
					},
				);

				// Write it as the new current value
				await entries.update(
					node.profile.universeId,
					node.dataStoreId,
					node.entryId,
					oldEntry.value,
					{ scope: node.scope },
				);

				vscode.window.showInformationMessage(
					`DataStoria: Entry "${node.entryId}" restored to revision ${node.revision.revisionId.slice(0, 8)}`,
				);
				treeProvider.refresh();
			} catch (error) {
				errorHandler.handle(error, 'restoring revision');
			}
		}),

		vscode.commands.registerCommand('datastoria.viewAtTimestamp', async (node?: EntryNode) => {
			if (!node) return;

			const timestamp = await vscode.window.showInputBox({
				prompt: 'Enter timestamp (ISO 8601)',
				placeHolder: 'e.g., 2026-03-15T10:00:00Z',
				validateInput: (v: string) => {
					const d = new Date(v);
					if (Number.isNaN(d.getTime())) return 'Invalid timestamp';
					return undefined;
				},
			});
			if (!timestamp) return;

			try {
				const isoTimestamp = new Date(timestamp).toISOString();
				const client = createClient(node.profile);
				const entries = new EntriesService(client);
				const entry = await entries.get(node.profile.universeId, node.dataStoreId, node.entryId, {
					scope: node.scope,
					timestamp: isoTimestamp,
				});

				const indent = vscode.workspace.getConfiguration('datastoria').get<number>('jsonIndent', 2);
				const content = JSON.stringify(entry.value, null, indent);
				const doc = await vscode.workspace.openTextDocument({
					content,
					language: 'json',
				});
				await vscode.window.showTextDocument(doc, { preview: true });
			} catch (error) {
				errorHandler.handle(error, 'viewing entry at timestamp');
			}
		}),

		vscode.commands.registerCommand('datastoria.diffRevisions', async (node?: EntryNode) => {
			if (!node) return;

			try {
				const client = createClient(node.profile);
				const revService = new RevisionsService(client);
				const response = await revService.list(
					node.profile.universeId,
					node.dataStoreId,
					node.entryId,
					{ scope: node.scope, maxPageSize: 50 },
				);

				const revisions = response.dataStoreEntries || [];
				if (revisions.length < 2) {
					vscode.window.showInformationMessage('DataStoria: Need at least 2 revisions to compare');
					return;
				}

				const revItems = revisions.map((rev) => ({
					label: rev.revisionId.slice(0, 8),
					description: new Date(rev.revisionCreateTime).toLocaleString(),
					detail: `State: ${rev.state}`,
					revisionId: rev.revisionId,
				}));

				const leftPick = await vscode.window.showQuickPick(revItems, {
					title: 'Compare Revisions: Select OLDER revision (left side)',
					placeHolder: 'Pick the base revision',
				});
				if (!leftPick) return;

				const rightItems = revItems.filter((r) => r.revisionId !== leftPick.revisionId);
				const rightPick = await vscode.window.showQuickPick(rightItems, {
					title: 'Compare Revisions: Select NEWER revision (right side)',
					placeHolder: 'Pick the revision to compare against',
				});
				if (!rightPick) return;

				const leftUri = encodeEntryUri({
					scheme: URI_SCHEME_REVISION,
					universeId: node.profile.universeId,
					dataStoreId: node.dataStoreId,
					scope: node.scope,
					entryId: node.entryId,
					revisionId: leftPick.revisionId,
				});
				const rightUri = encodeEntryUri({
					scheme: URI_SCHEME_REVISION,
					universeId: node.profile.universeId,
					dataStoreId: node.dataStoreId,
					scope: node.scope,
					entryId: node.entryId,
					revisionId: rightPick.revisionId,
				});

				await vscode.commands.executeCommand(
					'vscode.diff',
					leftUri,
					rightUri,
					`${node.entryId}: ${leftPick.label} ↔ ${rightPick.label}`,
				);
			} catch (error) {
				errorHandler.handle(error, 'comparing revisions');
			}
		}),
	);

	// Editor CodeLens commands (restore/diff from editor)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'datastoria.restoreFromEditor',
			async (params?: EntryUriParams) => {
				if (!params?.revisionId) return;

				const profile = profileManager
					.getUniverses()
					.find((u) => u.universeId === params.universeId);
				if (!profile) return;

				const confirm = await vscode.window.showWarningMessage(
					`Restore revision ${params.revisionId.slice(0, 8)}? This creates a new revision with that value.`,
					{ modal: true },
					'Restore',
				);
				if (confirm !== 'Restore') return;

				try {
					const client = createClient(profile);
					const entries = new EntriesService(client);

					const oldEntry = await entries.get(
						params.universeId,
						params.dataStoreId,
						params.entryId,
						{ scope: params.scope, revisionId: params.revisionId },
					);

					await entries.update(
						params.universeId,
						params.dataStoreId,
						params.entryId,
						oldEntry.value,
						{ scope: params.scope },
					);

					vscode.window.showInformationMessage(
						`DataStoria: Entry "${params.entryId}" restored to revision ${params.revisionId.slice(0, 8)}`,
					);
					treeProvider.refresh();
				} catch (error) {
					errorHandler.handle(error, 'restoring revision');
				}
			},
		),

		vscode.commands.registerCommand(
			'datastoria.diffFromEditor',
			async (params?: EntryUriParams) => {
				if (!params?.revisionId) return;

				const currentUri = encodeEntryUri({
					scheme: URI_SCHEME_ENTRY,
					universeId: params.universeId,
					dataStoreId: params.dataStoreId,
					scope: params.scope,
					entryId: params.entryId,
				});
				const revisionUri = encodeEntryUri({
					scheme: URI_SCHEME_REVISION,
					universeId: params.universeId,
					dataStoreId: params.dataStoreId,
					scope: params.scope,
					entryId: params.entryId,
					revisionId: params.revisionId,
				});

				await vscode.commands.executeCommand(
					'vscode.diff',
					revisionUri,
					currentUri,
					`${params.entryId}: ${params.revisionId.slice(0, 8)} ↔ Current`,
				);
			},
		),
	);

	// Universe stats
	context.subscriptions.push(
		vscode.commands.registerCommand('datastoria.showStats', async (node?: UniverseNode) => {
			if (!node) return;

			try {
				const stats = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: `DataStoria: Scanning ${node.profile.name}...`,
					},
					() => treeProvider.getUniverseStats(node.profile),
				);

				const content = generateStatsDocument(node.profile, stats);
				const doc = await vscode.workspace.openTextDocument({
					content,
					language: 'markdown',
				});
				await vscode.window.showTextDocument(doc, { preview: true });
			} catch (error) {
				errorHandler.handle(error, 'loading universe stats');
			}
		}),
	);

	// Bulk / DataStore operations (stubs for Phase 4)
	context.subscriptions.push(
		vscode.commands.registerCommand('datastoria.exportEntries', () => {
			vscode.window.showInformationMessage('DataStoria: Export coming soon');
		}),
		vscode.commands.registerCommand('datastoria.snapshotDataStores', () => {
			vscode.window.showInformationMessage('DataStoria: Snapshot coming soon');
		}),
		vscode.commands.registerCommand('datastoria.deleteDataStore', () => {
			vscode.window.showInformationMessage('DataStoria: Delete data store coming soon');
		}),
		vscode.commands.registerCommand('datastoria.undeleteDataStore', () => {
			vscode.window.showInformationMessage('DataStoria: Restore data store coming soon');
		}),
		vscode.commands.registerCommand('datastoria.collapseAll', () => {
			// Built-in collapse all via showCollapseAll: true on tree view
		}),
	);

	// Subscriptions
	context.subscriptions.push(treeView, statusBar, logger);

	logger.info('DataStoria extension activated');
}

function generateStatsDocument(
	profile: UniverseConfig,
	stats: { active: string[]; deleted: string[] },
): string {
	const total = stats.active.length + stats.deleted.length;
	const dsListActive = stats.active.map((n) => `- \`${n}\``).join('\n');
	const dsListDeleted =
		stats.deleted.length > 0
			? stats.deleted.map((n) => `- ~~\`${n}\`~~ *(deleted)*`).join('\n')
			: '';

	return `# ${profile.name} — Universe Stats

**Universe ID:** \`${profile.universeId}\`
**API Key:** \`${profile.apiKeyName}\`

---

## Data Stores

| Metric | Count |
|--------|-------|
| Active | ${stats.active.length} |
| Deleted | ${stats.deleted.length} |
| **Total** | **${total}** |

> Note: Data Stores Manager may not show detailed metrics for experiences with more than 100 data stores.

### Active Data Stores
${dsListActive || '*None found*'}

${dsListDeleted ? `### Deleted Data Stores\n${dsListDeleted}\n` : ''}
---

## Limits Reference

### Size Limits

| Resource | Limit |
|----------|-------|
| Data store name | 50 characters |
| Entry key name | 50 characters |
| Scope name | 50 characters |
| Entry value | 4,194,304 bytes (4 MB) |
| Metadata key name | 50 characters |
| Metadata value | 250 characters |
| Metadata total size | 300 characters |

### Per-Key Throughput (all servers combined)

| Direction | Limit |
|-----------|-------|
| Read | 25 MB/min |
| Write | 4 MB/min |

> Roblox rounds each request up to the next kilobyte.

### Storage Formula

\`\`\`
Total storage limit = 100 MB + 1 MB × lifetime user count
\`\`\`

Only the **latest version** of each key counts toward usage.
Deleted/replaced data (even if version-accessible) does not count.

### Versioning

- Backups created on **first write per key per UTC hour**
- Subsequent writes in the same hour permanently overwrite
- Old versions expire **30 days** after being overwritten
- The **latest version never expires**
- Snapshots: once per day limit

### Rate Limits (In-Experience, Current)

| Type | Formula |
|------|---------|
| Standard Get | 60 + players × 10 req/min |
| Standard Set | 60 + players × 10 req/min |
| Ordered Get Sorted | 5 + players × 2 req/min |
| Ordered Set | 30 + players × 5 req/min |
| List operations | 5 + players × 2 req/min |

### Rate Limits (Experience-Level, April 2026+)

| Type | Formula |
|------|---------|
| Standard Read | 250 + users × 40 req/min |
| Standard Write | 250 + users × 20 req/min |
| Standard List | 10 + users × 2 req/min |
| Standard Remove | 100 + users × 40 req/min |
| Ordered Read | 250 + users × 40 req/min |
| Ordered Write | 250 + users × 20 req/min |
| Ordered List | 100 + users × 2 req/min |
| Ordered Remove | 100 + users × 40 req/min |

> \`UpdateAsync()\` consumes **both** read and write budgets per call.

### Caching

- Default cache duration: **4 seconds**
- Cached reads don't count toward rate limits
- Cache is instance-local (different server instances have independent caches)

### Serialization

- Format: JSON
- Supported types: Nil, Booleans, Numbers, Strings, Tables, Buffers
- **Avoid** \`inf\`, \`-inf\`, \`nan\` — incompatible with JSON
- Numeric table keys convert to strings when table length is 0

---

*Generated by DataStoria · [Error Codes & Limits](https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits) · [Best Practices](https://create.roblox.com/docs/cloud-services/data-stores/best-practices)*
`;
}

export function deactivate() {}
