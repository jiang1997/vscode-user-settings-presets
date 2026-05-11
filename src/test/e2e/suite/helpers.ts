import * as vscode from 'vscode';
import { PRESETS_KEY, SELECTED_PRESET_KEY } from '../../../types';
import {
  PresetManagerPanel,
  getUserSettingsUri,
  readUserSettings,
} from '../../../presetManagerPanel';

export async function getExtensionContext(): Promise<vscode.ExtensionContext> {
  const ext = vscode.extensions.getExtension('jiang1997.user-settings-presets');
  if (!ext) throw new Error('Extension jiang1997.user-settings-presets not found');
  if (!ext.isActive) await ext.activate();
  return (ext.exports as { context: vscode.ExtensionContext }).context;
}

// Note: PresetManagerPanel.instance is a static singleton. After the first
// call, subsequent openPanel() invocations return the same instance (the
// `show` command calls `_panel.reveal()` rather than constructing a new
// panel). Tests that mutate state via panel.handleX(...) are safe because
// resetState() clears the underlying globalState the panel reads from.
export async function openPanel(): Promise<PresetManagerPanel> {
  await vscode.commands.executeCommand('userSettingsPresets.manage');
  const panel = PresetManagerPanel.instance;
  if (!panel) throw new Error('PresetManagerPanel.instance is undefined after executeCommand');
  return panel;
}

export async function resetState(ctx: vscode.ExtensionContext): Promise<void> {
  await ctx.globalState.update(PRESETS_KEY, []);
  await ctx.globalState.update(SELECTED_PRESET_KEY, undefined);
  const uri = getUserSettingsUri(ctx);
  try {
    await vscode.workspace.fs.delete(uri);
  } catch {
    // file may not exist; ignore
  }
}

export async function readSettings(ctx: vscode.ExtensionContext): Promise<Record<string, any>> {
  return readUserSettings(getUserSettingsUri(ctx));
}

let originalShowInformationMessage: typeof vscode.window.showInformationMessage | undefined;

export function stubReloadPrompt(): void {
  if (originalShowInformationMessage !== undefined) {
    throw new Error('stubReloadPrompt called while already stubbed; pair each call with restoreReloadPrompt');
  }
  originalShowInformationMessage = vscode.window.showInformationMessage;
  (vscode.window as any).showInformationMessage = () => Promise.resolve(undefined);
}

export function restoreReloadPrompt(): void {
  if (originalShowInformationMessage) {
    (vscode.window as any).showInformationMessage = originalShowInformationMessage;
    originalShowInformationMessage = undefined;
  }
}

let originalShowWarningMessage: typeof vscode.window.showWarningMessage | undefined;

export function stubDeleteConfirm(): void {
  if (originalShowWarningMessage !== undefined) {
    throw new Error('stubDeleteConfirm called while already stubbed; pair each call with restoreDeleteConfirm');
  }
  originalShowWarningMessage = vscode.window.showWarningMessage;
  (vscode.window as any).showWarningMessage = () => Promise.resolve('Delete');
}

export function restoreDeleteConfirm(): void {
  if (originalShowWarningMessage) {
    (vscode.window as any).showWarningMessage = originalShowWarningMessage;
    originalShowWarningMessage = undefined;
  }
}
