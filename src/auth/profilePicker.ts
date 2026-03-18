import * as vscode from 'vscode';
import { RobloxApiClient } from '../api/client';
import { DataStoresService } from '../api/dataStores';
import type { UniverseConfig } from '../api/types';
import type { ProfileManager } from './profiles';

export async function showAddApiKeyWizard(profileManager: ProfileManager): Promise<boolean> {
	const name = await vscode.window.showInputBox({
		title: 'Add API Key (1/2)',
		prompt: 'Give this API key a name',
		placeHolder: 'e.g., My Production Key',
		validateInput: (value: string) => {
			if (!value.trim()) return 'Name is required';
			if (profileManager.getApiKey(value)) return `API key "${value}" already exists`;
			return undefined;
		},
	});
	if (!name) return false;

	const secret = await vscode.window.showInputBox({
		title: 'Add API Key (2/2)',
		prompt: 'Paste your Roblox Open Cloud API key (stored in your OS keychain)',
		password: true,
		ignoreFocusOut: true,
		validateInput: (value: string) => {
			if (!value.trim()) return 'API key is required';
			return undefined;
		},
	});
	if (!secret) return false;

	await profileManager.addApiKey(name, secret);
	vscode.window.showInformationMessage(`DataStoria: API key "${name}" saved`);

	const addUniverse = await vscode.window.showInformationMessage(
		'Add a universe to browse its data stores?',
		'Add Universe',
		'Later',
	);
	if (addUniverse === 'Add Universe') {
		return showAddUniverseWizard(profileManager, name);
	}
	return true;
}

export async function showAddUniverseWizard(
	profileManager: ProfileManager,
	preselectedKeyName?: string,
): Promise<boolean> {
	const apiKeys = profileManager.getApiKeys();
	if (apiKeys.length === 0) {
		const add = await vscode.window.showWarningMessage(
			'No API keys configured. Add one first.',
			'Add API Key',
		);
		if (add === 'Add API Key') {
			return showAddApiKeyWizard(profileManager);
		}
		return false;
	}

	let apiKeyName: string;
	if (preselectedKeyName) {
		apiKeyName = preselectedKeyName;
	} else if (apiKeys.length === 1) {
		apiKeyName = apiKeys[0].name;
	} else {
		const picked = await vscode.window.showQuickPick(
			apiKeys.map((k) => ({ label: k.name })),
			{ title: 'Select API Key', placeHolder: 'Which API key to use for this universe?' },
		);
		if (!picked) return false;
		apiKeyName = picked.label;
	}

	const universeId = await vscode.window.showInputBox({
		title: 'Add Universe',
		prompt: 'Universe ID',
		placeHolder: 'e.g., 1234567890',
		validateInput: (value: string) => {
			if (!value.trim()) return 'Universe ID is required';
			if (!/^\d+$/.test(value)) return 'Universe ID must be a number';
			return undefined;
		},
	});
	if (!universeId) return false;

	const name = await vscode.window.showInputBox({
		title: 'Add Universe',
		prompt: 'Display name for this universe',
		placeHolder: 'e.g., My Game - Production',
		value: `Universe ${universeId}`,
		validateInput: (value: string) => {
			if (!value.trim()) return 'Name is required';
			if (profileManager.getUniverse(value)) return `Universe "${value}" already exists`;
			return undefined;
		},
	});
	if (!name) return false;

	const result = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'DataStoria: Validating connection...',
		},
		async () => {
			try {
				const secret = await profileManager.getApiKeySecret(apiKeyName);
				const client = new RobloxApiClient({ getApiKey: async () => secret });
				const service = new DataStoresService(client);
				await service.list(universeId, { maxPageSize: 1 });
				return { success: true as const };
			} catch (error) {
				return {
					success: false as const,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	if (!result.success) {
		const action = await vscode.window.showErrorMessage(
			`Connection failed: ${result.error}`,
			'Retry',
			'Save Anyway',
		);
		if (action === 'Retry') {
			return showAddUniverseWizard(profileManager, preselectedKeyName);
		}
		if (action !== 'Save Anyway') return false;
	}

	const universe: UniverseConfig = { name, universeId, apiKeyName };
	await profileManager.addUniverse(universe);
	vscode.window.showInformationMessage(`DataStoria: Universe "${name}" added`);
	return true;
}

export async function showEditApiKeyWizard(profileManager: ProfileManager): Promise<boolean> {
	const apiKeys = profileManager.getApiKeys();
	if (apiKeys.length === 0) {
		vscode.window.showWarningMessage('No API keys configured.');
		return false;
	}

	const picked = await vscode.window.showQuickPick(
		apiKeys.map((k) => ({ label: k.name })),
		{ title: 'Edit API Key', placeHolder: 'Select an API key to update its secret' },
	);
	if (!picked) return false;

	const newSecret = await vscode.window.showInputBox({
		title: `Update API Key: ${picked.label}`,
		prompt: 'Paste the new API key value (stored in your OS keychain)',
		password: true,
		ignoreFocusOut: true,
		validateInput: (value: string) => {
			if (!value.trim()) return 'API key is required';
			return undefined;
		},
	});
	if (!newSecret) return false;

	await profileManager.updateApiKeySecret(picked.label, newSecret);
	vscode.window.showInformationMessage(`DataStoria: API key "${picked.label}" updated`);
	return true;
}

export async function showDeleteApiKeyWizard(profileManager: ProfileManager): Promise<boolean> {
	const apiKeys = profileManager.getApiKeys();
	if (apiKeys.length === 0) {
		vscode.window.showWarningMessage('No API keys configured.');
		return false;
	}

	const picked = await vscode.window.showQuickPick(
		apiKeys.map((k) => {
			const universes = profileManager.getUniverses().filter((u) => u.apiKeyName === k.name);
			const desc =
				universes.length > 0 ? `Used by: ${universes.map((u) => u.name).join(', ')}` : 'Not used';
			return { label: k.name, description: desc };
		}),
		{ title: 'Delete API Key', placeHolder: 'Select an API key to remove' },
	);
	if (!picked) return false;

	const affectedUniverses = profileManager
		.getUniverses()
		.filter((u) => u.apiKeyName === picked.label);
	const warning =
		affectedUniverses.length > 0
			? `Delete API key "${picked.label}"? This will also remove ${affectedUniverses.length} universe(s) that use it.`
			: `Delete API key "${picked.label}"?`;

	const confirm = await vscode.window.showWarningMessage(warning, { modal: true }, 'Delete');
	if (confirm !== 'Delete') return false;

	await profileManager.deleteApiKey(picked.label);
	vscode.window.showInformationMessage(`DataStoria: API key "${picked.label}" deleted`);
	return true;
}

export async function showEditUniverseWizard(
	profileManager: ProfileManager,
	current: UniverseConfig,
): Promise<boolean> {
	const name = await vscode.window.showInputBox({
		title: 'Edit Universe',
		prompt: 'Display name',
		value: current.name,
		validateInput: (value: string) => {
			if (!value.trim()) return 'Name is required';
			if (value !== current.name && profileManager.getUniverse(value)) {
				return `Universe "${value}" already exists`;
			}
			return undefined;
		},
	});
	if (!name) return false;

	const universeId = await vscode.window.showInputBox({
		title: 'Edit Universe',
		prompt: 'Universe ID',
		value: current.universeId,
		validateInput: (value: string) => {
			if (!value.trim()) return 'Universe ID is required';
			if (!/^\d+$/.test(value)) return 'Universe ID must be a number';
			return undefined;
		},
	});
	if (!universeId) return false;

	const apiKeys = profileManager.getApiKeys();
	let apiKeyName = current.apiKeyName;
	if (apiKeys.length > 1) {
		const changeKey = await vscode.window.showQuickPick(
			[
				{ label: `Keep: ${current.apiKeyName}`, name: current.apiKeyName },
				...apiKeys
					.filter((k) => k.name !== current.apiKeyName)
					.map((k) => ({ label: `Switch to: ${k.name}`, name: k.name })),
			],
			{ title: 'API Key' },
		);
		if (!changeKey) return false;
		apiKeyName = changeKey.name;
	}

	await profileManager.updateUniverse(current.name, { name, universeId, apiKeyName });
	vscode.window.showInformationMessage('DataStoria: Universe updated');
	return true;
}
