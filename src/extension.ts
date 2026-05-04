import * as vscode from 'vscode';
import { loadProfiles, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';
import { ProfileManagerPanel } from './profileManagerPanel';

export function activate(context: vscode.ExtensionContext) {
  // ── First-run: import existing settings.json config ────────
  initDefaultProfile(context);

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

async function initDefaultProfile(context: vscode.ExtensionContext) {
  const profiles = loadProfiles(context);
  if (profiles.length > 0) { return; }

  const config = vscode.workspace.getConfiguration('claudeCode');
  const envVars: { name: string; value: string }[] | undefined = config.get('environmentVariables');
  if (!Array.isArray(envVars) || envVars.length === 0) { return; }

  const profile = {
    name: 'Default',
    envVars: envVars.map(e => ({ name: e.name, value: e.value })),
  };
  await context.globalState.update(PROFILES_KEY, [profile]);
}

function updateStatusBar(item: vscode.StatusBarItem, profileName?: string) {
  if (profileName) {
    item.text = `$(account) ${profileName}`;
    item.tooltip = `Active Claude API profile: ${profileName}`;
    item.show();
  } else {
    item.hide();
  }
}
