import * as vscode from 'vscode';
import { PresetManagerPanel } from './presetManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('userSettingsPresets.manage', () => {
      PresetManagerPanel.show(context);
    }),
  );
  return { context };
}

export function deactivate() {}
