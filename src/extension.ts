import * as vscode from 'vscode';
import { ApiProfile, SELECTED_PROFILE_KEY } from './types';
import { ProfileManagerPanel } from './profileManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  // ── Status bar ─────────────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claudeSettingManager.manageProfiles';
  context.subscriptions.push(statusBarItem);

  const activeProfile: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
  updateStatusBar(statusBarItem, activeProfile);

  // ── Manage Profiles ────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSettingManager.manageProfiles', () => {
      ProfileManagerPanel.show(context, statusBarItem);
    }),
  );
}

export function deactivate() {}

function updateStatusBar(item: vscode.StatusBarItem, profileName?: string) {
  if (profileName) {
    item.text = `$(account) ${profileName}`;
    item.tooltip = `Active Claude API profile: ${profileName}`;
    item.show();
  } else {
    item.hide();
  }
}
