import * as vscode from 'vscode';
import type { ApiKeyConfig, UniverseConfig } from '../api/types';
import type { ApiKeyStorage } from './secretStorage';

export class ProfileManager {
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChange = this._onDidChange.event;

	constructor(private readonly keyStorage: ApiKeyStorage) {}

	// --- API Keys ---

	getApiKeys(): ApiKeyConfig[] {
		return vscode.workspace.getConfiguration('datastoria').get<ApiKeyConfig[]>('apiKeys', []);
	}

	getApiKey(name: string): ApiKeyConfig | undefined {
		return this.getApiKeys().find((k) => k.name === name);
	}

	async addApiKey(name: string, secret: string): Promise<void> {
		const keys = this.getApiKeys();
		if (keys.some((k) => k.name === name)) {
			throw new Error(`API key "${name}" already exists`);
		}
		keys.push({ name });
		await this.saveApiKeys(keys);
		await this.keyStorage.store(name, secret);
		this._onDidChange.fire();
	}

	async deleteApiKey(name: string): Promise<void> {
		// Remove universes that reference this key
		const universes = this.getUniverses().filter((u) => u.apiKeyName !== name);
		const keys = this.getApiKeys().filter((k) => k.name !== name);
		await this.saveApiKeys(keys);
		await this.saveUniverses(universes);
		await this.keyStorage.delete(name);
		this._onDidChange.fire();
	}

	async updateApiKeySecret(name: string, newSecret: string): Promise<void> {
		await this.keyStorage.store(name, newSecret);
	}

	async getApiKeySecret(name: string): Promise<string | undefined> {
		return this.keyStorage.get(name);
	}

	// --- Universes ---

	getUniverses(): UniverseConfig[] {
		return vscode.workspace.getConfiguration('datastoria').get<UniverseConfig[]>('universes', []);
	}

	getUniverse(name: string): UniverseConfig | undefined {
		return this.getUniverses().find((u) => u.name === name);
	}

	async addUniverse(universe: UniverseConfig): Promise<void> {
		const universes = this.getUniverses();
		if (universes.some((u) => u.name === universe.name)) {
			throw new Error(`Universe "${universe.name}" already exists`);
		}
		universes.push(universe);
		await this.saveUniverses(universes);
		this._onDidChange.fire();
	}

	async updateUniverse(name: string, updates: Partial<UniverseConfig>): Promise<void> {
		const universes = this.getUniverses();
		const index = universes.findIndex((u) => u.name === name);
		if (index === -1) {
			throw new Error(`Universe "${name}" not found`);
		}
		universes[index] = { ...universes[index], ...updates };
		await this.saveUniverses(universes);
		this._onDidChange.fire();
	}

	async deleteUniverse(name: string): Promise<void> {
		const universes = this.getUniverses().filter((u) => u.name !== name);
		await this.saveUniverses(universes);
		this._onDidChange.fire();
	}

	// --- Helpers ---

	async getSecretForUniverse(universeName: string): Promise<string | undefined> {
		const universe = this.getUniverse(universeName);
		if (!universe) return undefined;
		return this.keyStorage.get(universe.apiKeyName);
	}

	private async saveApiKeys(keys: ApiKeyConfig[]): Promise<void> {
		const config = vscode.workspace.getConfiguration('datastoria');
		await config.update('apiKeys', keys, vscode.ConfigurationTarget.Global);
	}

	private async saveUniverses(universes: UniverseConfig[]): Promise<void> {
		const config = vscode.workspace.getConfiguration('datastoria');
		await config.update('universes', universes, vscode.ConfigurationTarget.Global);
	}
}
