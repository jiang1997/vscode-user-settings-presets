# Claude Profiles Tree View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Claude Profiles" sidebar panel with a tree view, status bar indicator, and context-menu actions (add, edit, delete, activate) for managing Claude API profiles.

**Architecture:** Extract ApiProfile and storage keys into `src/types.ts`. New `src/profileTreeProvider.ts` renders profiles as tree items. `extension.ts` registers the tree view, status bar, and five commands (add, edit, delete, activate, switch). `package.json` declares the view container, views, menus, and new commands.

**Tech Stack:** TypeScript, VS Code Extension API (vscode ^1.75.0)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | Create | Shared interface and storage-key constants |
| `src/profileTreeProvider.ts` | Create | TreeDataProvider + TreeItem for the sidebar panel |
| `src/extension.ts` | Modify | Register tree view, status bar, commands |
| `package.json` | Modify | Declare view container, views, menus, new commands |

---

### Task 1: Create shared types file

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export interface ApiProfile {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export const PROFILES_KEY = 'claudeApiProfiles';
export const SELECTED_PROFILE_KEY = 'selectedClaudeApiProfile';
```

- [ ] **Step 2: Compile to verify**

Run: `npm run compile`
Expected: No errors (the file exports types/consts used by future tasks; tsc won't error on an unused file).

---

### Task 2: Create ProfileTreeProvider

**Files:**
- Create: `src/profileTreeProvider.ts`

- [ ] **Step 1: Write `src/profileTreeProvider.ts`**

```typescript
import * as vscode from 'vscode';
import { ApiProfile, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';

export class ProfileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly profile: ApiProfile,
    isActive: boolean
  ) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);
    this.description = profile.baseUrl;
    this.contextValue = 'claudeProfile';
    this.iconPath = new vscode.ThemeIcon(isActive ? 'circle-filled' : 'circle-outline');
    this.command = {
      command: 'claudeSettingManager.activateProfile',
      title: 'Activate Profile',
      arguments: [this]
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

  getChildren(): ProfileTreeItem[] {
    const profiles: ApiProfile[] = this.context.globalState.get(PROFILES_KEY, []);
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
```

- [ ] **Step 2: Compile to verify**

Run: `npm run compile`
Expected: No errors (types and TreeView APIs are all from vscode ^1.75.0).

---

### Task 3: Update package.json contributions

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update activationEvents**

Replace the existing `activationEvents` array:

```json
"activationEvents": [
  "onView:claudeProfiles"
]
```

`onView:<id>` fires when the view container becomes visible, covering all commands.

- [ ] **Step 2: Add new commands to `contributes.commands`**

The existing two commands remain. Add these three after them:

```json
{
  "command": "claudeSettingManager.editProfile",
  "title": "Edit",
  "category": "Claude Setting"
},
{
  "command": "claudeSettingManager.deleteProfile",
  "title": "Delete",
  "category": "Claude Setting"
},
{
  "command": "claudeSettingManager.activateProfile",
  "title": "Activate Profile",
  "category": "Claude Setting"
}
```

- [ ] **Step 3: Add viewsContainers, views, and menus to `contributes`**

Add these top-level keys inside `contributes` (alongside existing `commands` and `configuration`):

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "claudeProfiles",
      "title": "Claude Profiles",
      "icon": "$(account)"
    }
  ]
},
"views": {
  "claudeProfiles": [
    {
      "id": "claudeProfiles",
      "name": "Profiles"
    }
  ]
},
"menus": {
  "view/item/context": [
    {
      "command": "claudeSettingManager.editProfile",
      "when": "view == claudeProfiles && viewItem == claudeProfile",
      "group": "inline"
    },
    {
      "command": "claudeSettingManager.deleteProfile",
      "when": "view == claudeProfiles && viewItem == claudeProfile"
    }
  ],
  "view/title": [
    {
      "command": "claudeSettingManager.addProfile",
      "when": "view == claudeProfiles",
      "group": "navigation"
    }
  ]
}
```

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

---

### Task 4: Rewrite extension.ts with tree view, status bar, and commands

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Replace `src/extension.ts` entirely**

```typescript
import * as vscode from 'vscode';
import { ApiProfile, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';
import { ProfileTreeItem, ProfileTreeProvider } from './profileTreeProvider';

export function activate(context: vscode.ExtensionContext) {
  // ── Tree view ──────────────────────────────────────────────
  const treeProvider = new ProfileTreeProvider(context);
  const treeView = vscode.window.createTreeView('claudeProfiles', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
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

  // Restore status bar on startup
  const activeProfile: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
  updateStatusBar(activeProfile);

  // ── Helpers ────────────────────────────────────────────────
  async function writeProfileToEnv(profile: ApiProfile) {
    const config = vscode.workspace.getConfiguration('claude-code');
    const extensionConfig = vscode.workspace.getConfiguration('claudeSettingManager');
    const baseUrlEnvName: string = extensionConfig.get('environmentVariableName') ?? 'ANTHROPIC_BASE_URL';
    const apiKeyEnvName = 'ANTHROPIC_API_KEY';

    let envVars: { name: string; value: string }[] | undefined = config.get('environmentVariables');
    if (!Array.isArray(envVars)) {
      envVars = [];
    }
    const otherVars = envVars.filter(e => e.name !== baseUrlEnvName && e.name !== apiKeyEnvName);
    const newEnvVars = [
      { name: baseUrlEnvName, value: profile.baseUrl },
      { name: apiKeyEnvName, value: profile.apiKey },
      ...otherVars
    ];
    await config.update('environmentVariables', newEnvVars, vscode.ConfigurationTarget.Global);
  }

  // ── Add Profile ────────────────────────────────────────────
  const addProfile = vscode.commands.registerCommand('claudeSettingManager.addProfile', async () => {
    const name = await vscode.window.showInputBox({ prompt: 'Enter a name for this Claude API profile' });
    if (!name) { return; }
    const baseUrl = await vscode.window.showInputBox({ prompt: 'Enter the API base URL for this profile' });
    if (!baseUrl) { return; }
    const apiKey = await vscode.window.showInputBox({ prompt: 'Enter the API key for this profile', password: true });
    if (!apiKey) { return; }
    const profiles: ApiProfile[] = context.globalState.get(PROFILES_KEY, []);
    profiles.push({ name, baseUrl, apiKey });
    await context.globalState.update(PROFILES_KEY, profiles);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Added Claude API profile: ${name}`);
  });
  context.subscriptions.push(addProfile);

  // ── Edit Profile ───────────────────────────────────────────
  const editProfile = vscode.commands.registerCommand('claudeSettingManager.editProfile', async (item: ProfileTreeItem) => {
    const profiles: ApiProfile[] = context.globalState.get(PROFILES_KEY, []);
    const idx = profiles.findIndex(p => p.name === item.profile.name);
    if (idx === -1) { return; }
    const p = profiles[idx];

    const name = await vscode.window.showInputBox({ prompt: 'Enter a name for this profile', value: p.name });
    if (!name) { return; }
    const baseUrl = await vscode.window.showInputBox({ prompt: 'Enter the API base URL', value: p.baseUrl });
    if (!baseUrl) { return; }
    const apiKey = await vscode.window.showInputBox({ prompt: 'Enter the API key', password: true, value: p.apiKey });
    if (!apiKey) { return; }

    profiles[idx] = { name, baseUrl, apiKey };
    await context.globalState.update(PROFILES_KEY, profiles);

    const activeProfileName: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
    if (activeProfileName === item.profile.name && name !== item.profile.name) {
      await context.globalState.update(SELECTED_PROFILE_KEY, name);
      updateStatusBar(name);
    }

    treeProvider.refresh();
    vscode.window.showInformationMessage(`Updated Claude API profile: ${name}`);
  });
  context.subscriptions.push(editProfile);

  // ── Delete Profile ─────────────────────────────────────────
  const deleteProfile = vscode.commands.registerCommand('claudeSettingManager.deleteProfile', async (item: ProfileTreeItem) => {
    const profiles: ApiProfile[] = context.globalState.get(PROFILES_KEY, []);
    const idx = profiles.findIndex(p => p.name === item.profile.name);
    if (idx === -1) { return; }

    const confirm = await vscode.window.showWarningMessage(
      `Delete profile "${item.profile.name}"? This cannot be undone.`,
      { modal: true },
      'Delete'
    );
    if (confirm !== 'Delete') { return; }

    profiles.splice(idx, 1);
    await context.globalState.update(PROFILES_KEY, profiles);

    const activeProfileName: string | undefined = context.globalState.get(SELECTED_PROFILE_KEY);
    if (activeProfileName === item.profile.name) {
      await context.globalState.update(SELECTED_PROFILE_KEY, undefined);
      const config = vscode.workspace.getConfiguration('claude-code');
      const extensionConfig = vscode.workspace.getConfiguration('claudeSettingManager');
      const baseUrlEnvName: string = extensionConfig.get('environmentVariableName') ?? 'ANTHROPIC_BASE_URL';
      const apiKeyEnvName = 'ANTHROPIC_API_KEY';
      const envVars: { name: string; value: string }[] | undefined = config.get('environmentVariables');
      if (Array.isArray(envVars)) {
        await config.update(
          'environmentVariables',
          envVars.filter(e => e.name !== baseUrlEnvName && e.name !== apiKeyEnvName),
          vscode.ConfigurationTarget.Global
        );
      }
      updateStatusBar(undefined);
    }

    treeProvider.refresh();
    vscode.window.showInformationMessage(`Deleted Claude API profile: ${item.profile.name}`);
  });
  context.subscriptions.push(deleteProfile);

  // ── Activate Profile ───────────────────────────────────────
  const activateProfile = vscode.commands.registerCommand('claudeSettingManager.activateProfile', async (item: ProfileTreeItem) => {
    await writeProfileToEnv(item.profile);
    await context.globalState.update(SELECTED_PROFILE_KEY, item.profile.name);
    updateStatusBar(item.profile.name);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Activated Claude API profile: ${item.profile.name}`);
  });
  context.subscriptions.push(activateProfile);

  // ── Switch Profile (legacy — kept for command palette) ─────
  const switchProfile = vscode.commands.registerCommand('claudeSettingManager.switchProfile', async () => {
    const profiles: ApiProfile[] = context.globalState.get(PROFILES_KEY, []);
    if (profiles.length === 0) {
      vscode.window.showErrorMessage('No Claude API profiles found. Use "Add Profile" to create one.');
      return;
    }
    const items = profiles.map(p => ({ label: p.name, description: p.baseUrl }));
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select which Claude API profile to activate'
    });
    if (!selection) { return; }
    const selectedProfile = profiles.find(p => p.name === selection.label);
    if (!selectedProfile) { return; }
    await writeProfileToEnv(selectedProfile);
    await context.globalState.update(SELECTED_PROFILE_KEY, selectedProfile.name);
    updateStatusBar(selectedProfile.name);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Switched to Claude API profile: ${selectedProfile.name}`);
  });
  context.subscriptions.push(switchProfile);
}

export function deactivate() {
  // Intentionally empty.
}
```

- [ ] **Step 2: Compile to verify**

Run: `npm run compile`
Expected: No TypeScript errors. The new file `out/extension.js` and `out/profileTreeProvider.js` should be produced.

---

### Task 5: End-to-end verification

- [ ] **Step 1: Check compiled output exists**

Run: `ls -la out/`
Expected: `extension.js`, `profileTreeProvider.js`, `types.js` all present with non-zero sizes.

- [ ] **Step 2: Check all commands are registered**

Run: `grep -c "registerCommand" out/extension.js`
Expected: `5` (addProfile, editProfile, deleteProfile, activateProfile, switchProfile)

- [ ] **Step 3: Check tree view ID is referenced**

Run: `grep -c "claudeProfiles" out/extension.js out/profileTreeProvider.js`
Expected: 2+ matches (createTreeView in extension.js, no need in provider)

- [ ] **Step 4: Test the extension in VS Code**

Run: `code --install-extension claude-setting-manager-1.0.0.vsix 2>/dev/null || echo "VS Code CLI not available — test by pressing F5 in the extension host"`
Manual verification:
1. Open the Claude Profiles panel in the activity bar
2. Click "+" to add a test profile
3. Click the profile to activate it — check the status bar updates
4. Right-click the profile → Edit — change the name
5. Right-click the profile → Delete — confirm deletion
