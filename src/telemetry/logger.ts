import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
	private readonly channel: vscode.OutputChannel;

	constructor(name: string) {
		this.channel = vscode.window.createOutputChannel(name);
	}

	info(message: string): void {
		this.channel.appendLine(`[INFO  ${this.timestamp()}] ${message}`);
	}

	warn(message: string): void {
		this.channel.appendLine(`[WARN  ${this.timestamp()}] ${message}`);
	}

	error(context: string, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? error.stack : undefined;
		this.channel.appendLine(`[ERROR ${this.timestamp()}] ${context}: ${message}`);
		if (stack) {
			this.channel.appendLine(stack);
		}
	}

	show(): void {
		this.channel.show();
	}

	dispose(): void {
		this.channel.dispose();
	}

	private timestamp(): string {
		return new Date().toISOString();
	}
}
