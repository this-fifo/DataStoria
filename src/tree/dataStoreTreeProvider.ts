import * as vscode from 'vscode';
import type { RobloxApiClient } from '../api/client';
import { RobloxApiError } from '../api/client';
import { DataStoresService } from '../api/dataStores';
import { EntriesService } from '../api/entries';
import { RevisionsService } from '../api/revisions';
import type { UniverseConfig } from '../api/types';
import type { ProfileManager } from '../auth/profiles';
import type { BaseNode } from './nodes/baseNode';
import { DataStoreGroupNode } from './nodes/dataStoreGroupNode';
import { DataStoreNode } from './nodes/dataStoreNode';
import { EntryNode } from './nodes/entryNode';
import { ErrorNode } from './nodes/errorNode';
import { FilterBarNode } from './nodes/filterBarNode';
import { LoadMoreNode } from './nodes/loadMoreNode';
import { RevisionNode } from './nodes/revisionNode';
import { ScopeNode } from './nodes/scopeNode';
import { UniverseNode } from './nodes/universeNode';

export type ApiClientFactory = (profile: UniverseConfig) => RobloxApiClient;

export class DataStoreTreeProvider implements vscode.TreeDataProvider<BaseNode> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<BaseNode | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private childrenCache = new WeakMap<BaseNode, BaseNode[]>();

	// Custom scopes added by the user (universeId:dataStoreId -> Set<scope>)
	private customScopes = new Map<string, Set<string>>();

	// Active search filters (universeId:dataStoreId:scopeId -> prefix)
	private activeFilters = new Map<string, string>();

	// Keep references to scope nodes so we can find them for filter operations
	private scopeNodeMap = new Map<string, ScopeNode>();

	constructor(
		private readonly profileManager: ProfileManager,
		private readonly clientFactory: ApiClientFactory,
	) {}

	getTreeItem(element: BaseNode): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: BaseNode): Promise<BaseNode[]> {
		if (!element) {
			return this.getRootNodes();
		}

		const cached = this.childrenCache.get(element);
		if (cached) return cached;

		try {
			const children = await this.resolveChildren(element);
			this.childrenCache.set(element, children);
			return children;
		} catch (error) {
			const nodes = this.createErrorNodes(element, error);
			this.childrenCache.set(element, nodes);
			return nodes;
		}
	}

	private getRootNodes(): BaseNode[] {
		const universes = this.profileManager.getUniverses();
		return universes.map((p) => new UniverseNode(p));
	}

	private async resolveChildren(element: BaseNode): Promise<BaseNode[]> {
		if (element instanceof UniverseNode) {
			return element.getChildren();
		}

		if (element instanceof DataStoreGroupNode) {
			return this.loadDataStores(element);
		}

		if (element instanceof DataStoreNode) {
			return this.loadScopes(element);
		}

		if (element instanceof ScopeNode) {
			return this.loadScopedEntries(element);
		}

		if (element instanceof EntryNode) {
			return this.loadRevisions(element);
		}

		return [];
	}

	private async loadDataStores(group: DataStoreGroupNode): Promise<BaseNode[]> {
		if (group.groupType === 'ordered') {
			return [
				new ErrorNode(
					group.profile,
					'Use right-click \u2192 Create Entry to add ordered data store entries',
				),
			];
		}

		const client = this.clientFactory(group.profile);
		const service = new DataStoresService(client);
		const pageSize = vscode.workspace.getConfiguration('datastoria').get<number>('pageSize', 50);
		const showDeleted = vscode.workspace
			.getConfiguration('datastoria')
			.get<boolean>('showDeletedDataStores', false);

		const response = await service.list(group.profile.universeId, {
			maxPageSize: pageSize,
			showDeleted,
		});

		const dataStores = response.dataStores || [];
		const nodes: BaseNode[] = dataStores.map((ds) => new DataStoreNode(group.profile, ds));

		if (response.nextPageToken) {
			nodes.push(new LoadMoreNode(group.profile, group, response.nextPageToken));
			group.description = `${dataStores.length}+ data stores`;
		} else {
			group.description = `${dataStores.length} data store${dataStores.length === 1 ? '' : 's'}`;
		}

		return nodes;
	}

	private async loadScopes(dsNode: DataStoreNode): Promise<BaseNode[]> {
		const client = this.clientFactory(dsNode.profile);
		const service = new EntriesService(client);

		// Fetch a small batch to discover scopes
		const response = await service.list(dsNode.profile.universeId, dsNode.dataStore.id, {
			maxPageSize: 100,
		});

		const entries = response.dataStoreEntries || [];
		const discoveredScopes = new Set<string>();
		for (const entry of entries) {
			const scope = this.extractScope(entry.path) || 'global';
			discoveredScopes.add(scope);
		}

		// Merge with any user-added custom scopes
		const key = `${dsNode.profile.universeId}:${dsNode.dataStore.id}`;
		const custom = this.customScopes.get(key);
		if (custom) {
			for (const s of custom) discoveredScopes.add(s);
		}

		if (discoveredScopes.size === 0) {
			discoveredScopes.add('global');
		}

		const scopes = Array.from(discoveredScopes).sort();
		const autoExpand = scopes.length === 1;

		const scopeNodes = scopes.map(
			(scope) => new ScopeNode(dsNode.profile, dsNode.dataStore.id, scope, autoExpand),
		);

		// Track scope nodes for filter operations
		for (const sn of scopeNodes) {
			const scopeKey = this.scopeKey(sn.profile.universeId, sn.dataStoreId, sn.scopeId);
			this.scopeNodeMap.set(scopeKey, sn);
		}

		return scopeNodes;
	}

	private async loadScopedEntries(scopeNode: ScopeNode): Promise<BaseNode[]> {
		const client = this.clientFactory(scopeNode.profile);
		const service = new EntriesService(client);
		const pageSize = vscode.workspace.getConfiguration('datastoria').get<number>('pageSize', 50);

		const filterKey = this.scopeKey(
			scopeNode.profile.universeId,
			scopeNode.dataStoreId,
			scopeNode.scopeId,
		);
		const activeFilter = this.activeFilters.get(filterKey);

		const response = await service.list(scopeNode.profile.universeId, scopeNode.dataStoreId, {
			scope: scopeNode.scopeId,
			maxPageSize: pageSize,
			filter: activeFilter ? `id.startsWith("${activeFilter}")` : undefined,
		});

		const entryNodes: BaseNode[] = (response.dataStoreEntries || []).map(
			(e) =>
				new EntryNode(
					scopeNode.profile,
					scopeNode.dataStoreId,
					scopeNode.scopeId,
					this.extractEntryKey(e.path) || e.id,
				),
		);

		const nodes: BaseNode[] = [];

		// Show filter bar when a filter is active
		if (activeFilter) {
			nodes.push(
				new FilterBarNode(
					scopeNode.profile,
					scopeNode.dataStoreId,
					scopeNode.scopeId,
					activeFilter,
					entryNodes.length,
				),
			);
		}

		nodes.push(...entryNodes);

		if (response.nextPageToken) {
			nodes.push(new LoadMoreNode(scopeNode.profile, scopeNode, response.nextPageToken));
		}

		return nodes;
	}

	private async loadRevisions(entryNode: EntryNode): Promise<BaseNode[]> {
		const client = this.clientFactory(entryNode.profile);
		const service = new RevisionsService(client);

		const response = await service.list(
			entryNode.profile.universeId,
			entryNode.dataStoreId,
			entryNode.entryId,
			{
				scope: entryNode.scope,
				maxPageSize: 20,
			},
		);

		return (response.dataStoreEntries || []).map(
			(rev, i) =>
				new RevisionNode(
					entryNode.profile,
					entryNode.dataStoreId,
					entryNode.scope,
					entryNode.entryId,
					rev,
					i === 0,
				),
		);
	}

	private createErrorNodes(parent: BaseNode, error: unknown): BaseNode[] {
		if (error instanceof RobloxApiError) {
			if (error.status === 401 || error.status === 403 || error.code === 'PERMISSION_DENIED') {
				return [
					new ErrorNode(parent.profile, 'Resources not authorized.'),
					new ErrorNode(
						parent.profile,
						'Ensure your API key has the required v2 scopes (e.g. universe-datastores.control:list)',
					),
				];
			}
			if (error.code === 'NOT_FOUND') {
				return [new ErrorNode(parent.profile, 'Universe not found. Check the Universe ID.')];
			}
		}
		return [new ErrorNode(parent.profile, error)];
	}

	private extractScope(path: string): string | undefined {
		const match = path.match(/\/scopes\/([^/]+)\//);
		return match?.[1];
	}

	private extractEntryKey(path: string): string | undefined {
		const match = path.match(/\/entries\/(.+)$/);
		return match?.[1];
	}

	private scopeKey(universeId: string, dataStoreId: string, scopeId: string): string {
		return `${universeId}:${dataStoreId}:${scopeId}`;
	}

	// Public API

	addCustomScope(dsNode: DataStoreNode, scope: string): void {
		const key = `${dsNode.profile.universeId}:${dsNode.dataStore.id}`;
		const existing = this.customScopes.get(key) ?? new Set();
		existing.add(scope);
		this.customScopes.set(key, existing);
		this.refresh(dsNode);
	}

	setFilter(universeId: string, dataStoreId: string, scopeId: string, prefix: string): void {
		const key = this.scopeKey(universeId, dataStoreId, scopeId);
		this.activeFilters.set(key, prefix);
		const scopeNode = this.scopeNodeMap.get(key);
		if (scopeNode) {
			scopeNode.setFilterActive(true);
			this.refresh(scopeNode);
		}
	}

	clearFilter(universeId: string, dataStoreId: string, scopeId: string): void {
		const key = this.scopeKey(universeId, dataStoreId, scopeId);
		this.activeFilters.delete(key);
		const scopeNode = this.scopeNodeMap.get(key);
		if (scopeNode) {
			scopeNode.setFilterActive(false);
			this.refresh(scopeNode);
		}
	}

	async loadMoreChildren(loadMoreNode: LoadMoreNode): Promise<void> {
		const parent = loadMoreNode.parentNode;

		if (parent instanceof DataStoreGroupNode && parent.groupType === 'standard') {
			const client = this.clientFactory(parent.profile);
			const service = new DataStoresService(client);
			const pageSize = vscode.workspace.getConfiguration('datastoria').get<number>('pageSize', 50);

			const response = await service.list(parent.profile.universeId, {
				maxPageSize: pageSize,
				pageToken: loadMoreNode.nextPageToken,
			});

			const newNodes: BaseNode[] = (response.dataStores || []).map(
				(ds) => new DataStoreNode(parent.profile, ds),
			);
			if (response.nextPageToken) {
				newNodes.push(new LoadMoreNode(parent.profile, parent, response.nextPageToken));
			}

			this.appendChildren(parent, newNodes);

			// Update count on group description
			const allChildren = this.childrenCache.get(parent) ?? [];
			const dsCount = allChildren.filter((c) => c instanceof DataStoreNode).length;
			parent.description = response.nextPageToken
				? `${dsCount}+ data stores`
				: `${dsCount} data store${dsCount === 1 ? '' : 's'}`;
			return;
		}

		if (parent instanceof ScopeNode) {
			const client = this.clientFactory(parent.profile);
			const service = new EntriesService(client);
			const pageSize = vscode.workspace.getConfiguration('datastoria').get<number>('pageSize', 50);

			const filterKey = this.scopeKey(
				parent.profile.universeId,
				parent.dataStoreId,
				parent.scopeId,
			);
			const activeFilter = this.activeFilters.get(filterKey);

			const response = await service.list(parent.profile.universeId, parent.dataStoreId, {
				scope: parent.scopeId,
				maxPageSize: pageSize,
				pageToken: loadMoreNode.nextPageToken,
				filter: activeFilter ? `id.startsWith("${activeFilter}")` : undefined,
			});

			const newNodes: BaseNode[] = (response.dataStoreEntries || []).map(
				(e) =>
					new EntryNode(
						parent.profile,
						parent.dataStoreId,
						parent.scopeId,
						this.extractEntryKey(e.path) || e.id,
					),
			);
			if (response.nextPageToken) {
				newNodes.push(new LoadMoreNode(parent.profile, parent, response.nextPageToken));
			}

			this.appendChildren(parent, newNodes);
		}
	}

	private appendChildren(parent: BaseNode, newChildren: BaseNode[]): void {
		const existing = this.childrenCache.get(parent) ?? [];
		const filtered = existing.filter((c) => c.contextValue !== 'loadMore');
		filtered.push(...newChildren);
		this.childrenCache.set(parent, filtered);
		this._onDidChangeTreeData.fire(parent);
	}

	async getUniverseStats(
		profile: UniverseConfig,
	): Promise<{ active: string[]; deleted: string[] }> {
		const client = this.clientFactory(profile);
		const service = new DataStoresService(client);

		const active: string[] = [];
		const deleted: string[] = [];
		let pageToken: string | undefined;

		do {
			const response = await service.list(profile.universeId, {
				maxPageSize: 100,
				pageToken,
				showDeleted: true,
			});

			for (const ds of response.dataStores || []) {
				if (ds.deleteTime) {
					deleted.push(ds.id);
				} else {
					active.push(ds.id);
				}
			}

			pageToken = response.nextPageToken;
		} while (pageToken);

		return { active, deleted };
	}

	refresh(node?: BaseNode): void {
		if (node) {
			this.childrenCache.delete(node);
		} else {
			this.childrenCache = new WeakMap();
		}
		this._onDidChangeTreeData.fire(node);
	}
}
