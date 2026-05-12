import * as vscode from 'vscode';
import { PresetManagerPanel, setOutputChannel } from './presetManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('User Settings Presets');
  context.subscriptions.push(channel);
  setOutputChannel(channel);

  context.subscriptions.push(
    vscode.commands.registerCommand('userSettingsPresets.manage', () => {
      PresetManagerPanel.show(context);
    }),
  );
  return { context };
}

export function deactivate() {}
