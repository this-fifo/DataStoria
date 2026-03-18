import type * as vscode from 'vscode';
import { SECRET_KEY_PREFIX } from '../constants';

export class ApiKeyStorage {
	constructor(private readonly secrets: vscode.SecretStorage) {}

	async get(profileName: string): Promise<string | undefined> {
		return this.secrets.get(`${SECRET_KEY_PREFIX}${profileName}`);
	}

	async store(profileName: string, apiKey: string): Promise<void> {
		await this.secrets.store(`${SECRET_KEY_PREFIX}${profileName}`, apiKey);
	}

	async delete(profileName: string): Promise<void> {
		await this.secrets.delete(`${SECRET_KEY_PREFIX}${profileName}`);
	}

	async rename(oldName: string, newName: string): Promise<void> {
		const key = await this.get(oldName);
		if (key) {
			await this.store(newName, key);
			await this.delete(oldName);
		}
	}
}
