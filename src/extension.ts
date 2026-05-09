import * as vscode from 'vscode';
import { SELECTED_PROFILE_KEY } from './types';
import { ProfileManagerPanel } from './profileManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'settingProfileManager.manageProfiles';
  context.subscriptions.push(statusBarItem);

  const activeProfile: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
  updateStatusBar(statusBarItem, activeProfile);

  context.subscriptions.push(
    vscode.commands.registerCommand('settingProfileManager.manageProfiles', () => {
      ProfileManagerPanel.show(context, statusBarItem);
    }),
  );
}

export function deactivate() {}

function updateStatusBar(item: vscode.StatusBarItem, profileName?: string) {
  if (profileName) {
    item.text = `$(account) ${profileName}`;
    item.tooltip = `Active profile: ${profileName}`;
    item.show();
  } else {
    item.hide();
  }
}
