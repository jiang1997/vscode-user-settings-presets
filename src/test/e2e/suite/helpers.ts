import * as vscode from 'vscode';
import { PRESETS_KEY, APPLIED_PRESET_KEY } from '../../../types';
import type * as PMP from '../../../presetManagerPanel';

interface ExtensionExports {
  context: vscode.ExtensionContext;
  panelClass: typeof PMP.PresetManagerPanel;
  getUserSettingsUri: typeof PMP.getUserSettingsUri;
  readUserSettings: typeof PMP.readUserSettings;
}

async function getExports(): Promise<ExtensionExports> {
  const ext = vscode.extensions.getExtension('jiang1997.user-settings-presets');
  if (!ext) throw new Error('Extension jiang1997.user-settings-presets not found');
  if (!ext.isActive) await ext.activate();
  return ext.exports as ExtensionExports;
}

export async function getExtensionContext(): Promise<vscode.ExtensionContext> {
  return (await getExports()).context;
}

// Note: PresetManagerPanel.instance is a static singleton. After the first
// call, subsequent openPanel() invocations return the same instance (the
// `show` command calls `_panel.reveal()` rather than constructing a new
// panel). Tests that mutate state via panel.handleX(...) are safe because
// resetState() clears the underlying globalState the panel reads from.
export async function openPanel(): Promise<PMP.PresetManagerPanel> {
  await vscode.commands.executeCommand('userSettingsPresets.manage');
  const { panelClass } = await getExports();
  const panel = panelClass.instance;
  if (!panel) throw new Error('PresetManagerPanel.instance is undefined after executeCommand');
  return panel;
}

export async function resetState(ctx: vscode.ExtensionContext): Promise<void> {
  const { getUserSettingsUri } = await getExports();
  await ctx.globalState.update(PRESETS_KEY, []);
  await ctx.globalState.update(APPLIED_PRESET_KEY, undefined);
  const uri = getUserSettingsUri(ctx);
  try {
    await vscode.workspace.fs.delete(uri);
  } catch {
    // file may not exist; ignore
  }
}

export async function readSettings(ctx: vscode.ExtensionContext): Promise<Record<string, unknown>> {
  const { getUserSettingsUri, readUserSettings } = await getExports();
  return readUserSettings(getUserSettingsUri(ctx));
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableWindow = Mutable<typeof vscode.window>;

let originalShowInformationMessage: typeof vscode.window.showInformationMessage | undefined;

export function stubReloadPrompt(): void {
  if (originalShowInformationMessage !== undefined) {
    throw new Error('stubReloadPrompt called while already stubbed; pair each call with restoreReloadPrompt');
  }
  originalShowInformationMessage = vscode.window.showInformationMessage;
  (vscode.window as MutableWindow).showInformationMessage =
    (() => Promise.resolve(undefined)) as unknown as typeof vscode.window.showInformationMessage;
}

export function restoreReloadPrompt(): void {
  if (originalShowInformationMessage) {
    (vscode.window as MutableWindow).showInformationMessage = originalShowInformationMessage;
    originalShowInformationMessage = undefined;
  }
}

let originalShowWarningMessage: typeof vscode.window.showWarningMessage | undefined;

export function stubDeleteConfirm(): void {
  if (originalShowWarningMessage !== undefined) {
    throw new Error('stubDeleteConfirm called while already stubbed; pair each call with restoreDeleteConfirm');
  }
  originalShowWarningMessage = vscode.window.showWarningMessage;
  (vscode.window as MutableWindow).showWarningMessage =
    (() => Promise.resolve('Delete')) as unknown as typeof vscode.window.showWarningMessage;
}

export function restoreDeleteConfirm(): void {
  if (originalShowWarningMessage) {
    (vscode.window as MutableWindow).showWarningMessage = originalShowWarningMessage;
    originalShowWarningMessage = undefined;
  }
}
