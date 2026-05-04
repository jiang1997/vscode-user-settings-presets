import * as vscode from 'vscode';
import { ApiProfile, EnvVar, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';
import { ProfileTreeItem, ProfileTreeProvider, loadProfiles } from './profileTreeProvider';
import { ProfileEditorPanel } from './profileEditorPanel';

export function activate(context: vscode.ExtensionContext) {
  // ── Tree view ──────────────────────────────────────────────
  const treeProvider = new ProfileTreeProvider(context);
  const treeView = vscode.window.createTreeView('claudeProfiles', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView);
  treeView.message = 'No profiles saved yet';

  // ── Status bar ─────────────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claudeSettingManager.switchProfile';
  context.subscriptions.push(statusBarItem);

  function updateStatusBar(profileName?: string) {
    if (profileName) {
      statusBarItem.text = `$(account) ${profileName}`;
      statusBarItem.tooltip = `Active Claude API profile: ${profileName}`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }
  const activeProfile: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
  updateStatusBar(activeProfile);

  // ── Helpers ────────────────────────────────────────────────
  async function writeEnvVars(envVars: EnvVar[]) {
    const config = vscode.workspace.getConfiguration('claudeCode');
    const filled = envVars.filter(e => e.value !== '');
    await config.update('environmentVariables', filled, vscode.ConfigurationTarget.Global);
  }

  async function clearEnvVars() {
    const config = vscode.workspace.getConfiguration('claudeCode');
    await config.update('environmentVariables', [], vscode.ConfigurationTarget.Global);
  }

  // ── Add Profile ────────────────────────────────────────────
  const addProfile = vscode.commands.registerCommand('claudeSettingManager.addProfile', async () => {
    try {
      const result = await ProfileEditorPanel.show(context);
      if (!result) { return; }
      const profiles = loadProfiles(context);
      profiles.push(result);
      await context.globalState.update(PROFILES_KEY, profiles);
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Added profile: ${result.name}`);
    } catch (e) {
      vscode.window.showErrorMessage(`Add profile failed: ${e}`);
    }
  });
  context.subscriptions.push(addProfile);

  // ── Edit Profile ───────────────────────────────────────────
  const editProfile = vscode.commands.registerCommand('claudeSettingManager.editProfile', async (item: ProfileTreeItem) => {
    try {
      if (!item?.profile?.name) {
        vscode.window.showErrorMessage('Edit failed: no profile data on tree item.');
        return;
      }
      const profiles = loadProfiles(context);
      const storedNames = profiles.map(p => p.name).join(', ');
      const idx = profiles.findIndex(p => p.name === item.profile.name);
      if (idx === -1) {
        vscode.window.showErrorMessage(`Edit failed: profile "${item.profile.name}" not in storage. Stored: [${storedNames || 'none'}]`);
        return;
      }

      const result = await ProfileEditorPanel.show(context, profiles[idx]);
      if (!result) { return; }

      const oldName = profiles[idx].name;
      profiles[idx] = result;
      await context.globalState.update(PROFILES_KEY, profiles);

      const activeProfileName: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
      if (activeProfileName === oldName) {
        if (result.name !== oldName) {
          await context.globalState.update(SELECTED_PROFILE_KEY, result.name);
        }
        await writeEnvVars(result.envVars);
        updateStatusBar(result.name);
      }

      treeProvider.refresh();
      vscode.window.showInformationMessage(`Updated profile: ${result.name}`);
    } catch (e) {
      vscode.window.showErrorMessage(`Edit failed: ${e}`);
    }
  });
  context.subscriptions.push(editProfile);

  // ── Delete Profile ─────────────────────────────────────────
  const deleteProfile = vscode.commands.registerCommand('claudeSettingManager.deleteProfile', async (item: ProfileTreeItem) => {
    const profiles = loadProfiles(context);
    const idx = profiles.findIndex(p => p.name === item.profile.name);
    if (idx === -1) { return; }

    const confirm = await vscode.window.showWarningMessage(
      `Delete profile "${item.profile.name}"? This cannot be undone.`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') { return; }

    const removed = profiles.splice(idx, 1)[0];
    await context.globalState.update(PROFILES_KEY, profiles);

    const activeProfileName: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
    if (activeProfileName === removed.name) {
      await context.globalState.update(SELECTED_PROFILE_KEY, undefined);
      await clearEnvVars();
      updateStatusBar(undefined);
    }

    treeProvider.refresh();
    vscode.window.showInformationMessage(`Deleted profile: ${removed.name}`);
  });
  context.subscriptions.push(deleteProfile);

  // ── Activate Profile ───────────────────────────────────────
  const activateProfile = vscode.commands.registerCommand('claudeSettingManager.activateProfile', async (item: ProfileTreeItem) => {
    await writeEnvVars(item.profile.envVars);
    await context.globalState.update(SELECTED_PROFILE_KEY, item.profile.name);
    updateStatusBar(item.profile.name);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Activated profile: ${item.profile.name}`);
  });
  context.subscriptions.push(activateProfile);

  // ── Switch Profile (command palette) ───────────────────────
  const switchProfile = vscode.commands.registerCommand('claudeSettingManager.switchProfile', async () => {
    const profiles = loadProfiles(context);
    if (profiles.length === 0) {
      vscode.window.showErrorMessage('No profiles found. Use "Claude Setting: Add Profile" to create one.');
      return;
    }
    const items = profiles.map(p => ({
      label: p.name,
      description: `${p.envVars.length} variable${p.envVars.length !== 1 ? 's' : ''}`,
    }));
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select which profile to activate',
    });
    if (!selection) { return; }
    const selectedProfile = profiles.find(p => p.name === selection.label);
    if (!selectedProfile) { return; }
    await writeEnvVars(selectedProfile.envVars);
    await context.globalState.update(SELECTED_PROFILE_KEY, selectedProfile.name);
    updateStatusBar(selectedProfile.name);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Switched to profile: ${selectedProfile.name}`);
  });
  context.subscriptions.push(switchProfile);
}

export function deactivate() {}
