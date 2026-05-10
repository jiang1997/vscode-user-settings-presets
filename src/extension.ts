import * as vscode from 'vscode';
import { SELECTED_PRESET_KEY } from './types';
import { PresetManagerPanel } from './presetManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'userSettingsPresets.manage';
  context.subscriptions.push(statusBarItem);

  const activePreset: string | undefined = context.globalState.get(SELECTED_PRESET_KEY);
  updateStatusBar(statusBarItem, activePreset);

  context.subscriptions.push(
    vscode.commands.registerCommand('userSettingsPresets.manage', () => {
      PresetManagerPanel.show(context, statusBarItem);
    }),
  );
}

export function deactivate() {}

function updateStatusBar(item: vscode.StatusBarItem, presetName?: string) {
  if (presetName) {
    item.text = `$(account) ${presetName}`;
    item.tooltip = `Active preset: ${presetName}`;
    item.show();
  } else {
    item.hide();
  }
}
