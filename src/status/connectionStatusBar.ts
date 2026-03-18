import * as vscode from 'vscode';
import type { ProfileManager } from '../auth/profiles';

export class ConnectionStatusBar implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(profileManager: ProfileManager) {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.command = 'datastoria.addApiKey';

		const update = () => {
			const universes = profileManager.getUniverses();
			if (universes.length === 0) {
				this.item.text = '$(plug) DataStoria: No universes';
				this.item.tooltip = 'Click to add an API key';
			} else {
				this.item.text = `$(plug) DataStoria: ${universes.length} universe${universes.length > 1 ? 's' : ''}`;
				this.item.tooltip = universes.map((u) => `${u.name} (${u.universeId})`).join('\n');
			}
			this.item.show();
		};

		update();
		this.disposables.push(profileManager.onDidChange(update));
	}

	dispose(): void {
		this.item.dispose();
		for (const d of this.disposables) d.dispose();
	}
}
