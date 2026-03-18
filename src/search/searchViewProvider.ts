import type * as vscode from 'vscode';
import type { UniverseConfig } from '../api/types';
import type { DataStoreTreeProvider } from '../tree/dataStoreTreeProvider';

export interface SearchContext {
	profile: UniverseConfig;
	dataStoreId: string;
	scopeId: string;
}

export class SearchViewProvider implements vscode.WebviewViewProvider {
	static readonly viewId = 'datastoria.search';

	private view?: vscode.WebviewView;
	private context?: SearchContext;

	constructor(private readonly treeProvider: DataStoreTreeProvider) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;

		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml();

		webviewView.webview.onDidReceiveMessage((msg) => {
			if (msg.type === 'filter') {
				if (!this.context) return;
				if (msg.value) {
					this.treeProvider.setFilter(
						this.context.profile.universeId,
						this.context.dataStoreId,
						this.context.scopeId,
						msg.value,
					);
				} else {
					this.treeProvider.clearFilter(
						this.context.profile.universeId,
						this.context.dataStoreId,
						this.context.scopeId,
					);
				}
			}
		});
	}

	setContext(ctx: SearchContext | undefined): void {
		const changed =
			ctx?.dataStoreId !== this.context?.dataStoreId ||
			ctx?.scopeId !== this.context?.scopeId ||
			ctx?.profile.universeId !== this.context?.profile.universeId;

		this.context = ctx;
		if (this.view && changed) {
			this.view.webview.postMessage({
				type: 'context',
				dataStoreId: ctx?.dataStoreId ?? '',
				scopeId: ctx?.scopeId ?? '',
			});
		}
	}

	/** Reveal the search panel and focus the input */
	focus(): void {
		if (this.view) {
			this.view.show(true);
			this.view.webview.postMessage({ type: 'focus' });
		}
	}

	private getHtml(): string {
		return `<!DOCTYPE html>
<html>
<head>
<style>
	* { box-sizing: border-box; margin: 0; padding: 0; }
	body {
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
		color: var(--vscode-foreground);
		padding: 8px;
	}
	.context {
		font-size: 11px;
		color: var(--vscode-descriptionForeground);
		margin-bottom: 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.context.empty {
		font-style: italic;
	}
	.input-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	input {
		flex: 1;
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		border: 1px solid var(--vscode-input-border, transparent);
		border-radius: 2px;
		padding: 3px 6px;
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
		outline: none;
	}
	input:focus {
		border-color: var(--vscode-focusBorder);
	}
	input::placeholder {
		color: var(--vscode-input-placeholderForeground);
	}
	button {
		background: none;
		border: none;
		color: var(--vscode-icon-foreground);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 4px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.7;
	}
	button:hover {
		background: var(--vscode-toolbar-hoverBackground);
		opacity: 1;
	}
	button.hidden { display: none; }
</style>
</head>
<body>
	<div class="context empty" id="context">Select a data store or scope</div>
	<div class="input-row">
		<input type="text" id="input" placeholder="Filter by key prefix..." disabled />
		<button id="clear" class="hidden" title="Clear filter">&#x2715;</button>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('input');
		const clear = document.getElementById('clear');
		const ctx = document.getElementById('context');

		let debounceTimer;
		let currentCtxKey = '';

		// Restore persisted state
		const saved = vscode.getState();
		if (saved && saved.value) {
			input.value = saved.value;
			clear.classList.toggle('hidden', !saved.value);
		}

		function saveState() {
			vscode.setState({ value: input.value, ctxKey: currentCtxKey });
		}

		input.addEventListener('input', () => {
			clear.classList.toggle('hidden', !input.value);
			saveState();
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				vscode.postMessage({ type: 'filter', value: input.value });
			}, 300);
		});

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				input.value = '';
				clear.classList.add('hidden');
				saveState();
				vscode.postMessage({ type: 'filter', value: '' });
			}
		});

		clear.addEventListener('click', () => {
			input.value = '';
			clear.classList.add('hidden');
			saveState();
			vscode.postMessage({ type: 'filter', value: '' });
			input.focus();
		});

		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg.type === 'context') {
				const newKey = msg.dataStoreId + '/' + msg.scopeId;
				const contextChanged = newKey !== currentCtxKey;
				currentCtxKey = newKey;

				if (msg.dataStoreId) {
					ctx.textContent = msg.dataStoreId + ' / ' + msg.scopeId;
					ctx.classList.remove('empty');
					input.disabled = false;
					input.placeholder = 'Filter by key prefix...';
				} else {
					ctx.textContent = 'Select a data store or scope';
					ctx.classList.add('empty');
					input.disabled = true;
					input.placeholder = 'Select a scope first';
				}
				if (contextChanged) {
					input.value = '';
					clear.classList.add('hidden');
					saveState();
				}
			} else if (msg.type === 'focus') {
				input.focus();
			}
		});
	</script>
</body>
</html>`;
	}
}
