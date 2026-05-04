import * as vscode from 'vscode';
import { ApiProfile, loadProfiles, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';

export class ProfileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly profile: ApiProfile,
    isActive: boolean,
  ) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);
    const count = profile.envVars.length;
    this.description = count > 0
      ? `${count} variable${count !== 1 ? 's' : ''}`
      : 'empty';
    this.contextValue = 'claudeProfile';
    this.iconPath = new vscode.ThemeIcon(isActive ? 'circle-filled' : 'circle-outline');
    this.command = {
      command: 'claudeSettingManager.activateProfile',
      title: 'Activate Profile',
      arguments: [this],
    };
  }
}

export class ProfileTreeProvider implements vscode.TreeDataProvider<ProfileTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProfileTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProfileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProfileTreeItem): ProfileTreeItem[] {
    if (element) { return []; }
    const profiles = loadProfiles(this.context);
    const activeProfileName: string | undefined = this.context.globalState.get(SELECTED_PROFILE_KEY);
    const items = profiles.map(p => new ProfileTreeItem(p, p.name === activeProfileName));
    items.sort((a, b) => {
      const aActive = a.profile.name === activeProfileName ? 1 : 0;
      const bActive = b.profile.name === activeProfileName ? 1 : 0;
      return bActive - aActive;
    });
    return items;
  }

  getParent(): null {
    return null;
  }
}
