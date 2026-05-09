# Generalize VS Code: Settings Profile Manager

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Claude Code:-specific profile manager into a general VS Code: extension that can manage arbitrary settings in `settings.json`.

**Architecture:** Each profile stores a target setting key (e.g., `python.defaultInterpreterPath`) and a raw JSON value. The backend writes the value to that key in `settings.json` on activation. The webview UI provides a raw JSON editor for the value and a text input for the setting key.

**Tech Stack:** TypeScript, VS Code: Extension API, esbuild, Mocha

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Define `SettingProfile`, update keys, remove legacy types |
| `src/extension.ts` | Modify | Remove first-run import, generic status bar |
| `src/profileManagerPanel.ts` | Modify | Generic `writeSetting`/`clearSetting`, update handlers |
| `media/index.html` | Modify | Replace env var table with Setting Key + JSON Value |
| `src/webview/script.ts` | Modify | JSON editor UI, new message format |
| `package.json` | Modify | Generic metadata, command IDs, remove Claude config |
| `src/test/profileCrud.test.ts` | Modify | Test `SettingProfile` CRUD |
| `src/test/migration.test.ts` | Delete | No longer needed |
| `src/test/importParser.test.ts` | Delete | No longer needed |
| `src/test/envFilter.test.ts` | Delete | No longer needed |

---

### Task 1: Update Data Model (`src/types.ts`)

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace entire file content**

```typescript
import * as vscode from 'vscode';

export interface SettingProfile {
  name: string;
  settingKey: string;
  value: any;
}

export const PROFILES_KEY = 'settingProfiles';
export const SELECTED_PROFILE_KEY = 'selectedSettingProfile';

export function loadProfiles(context: vscode.ExtensionContext): SettingProfile[] {
  return context.globalState.get(PROFILES_KEY, []);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "refactor: replace ApiProfile with SettingProfile"
```

---

### Task 2: Update Extension Host (`src/extension.ts`)

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Replace entire file content**

```typescript
import * as vscode from 'vscode';
import { loadProfiles, SELECTED_PROFILE_KEY } from './types';
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
```

- [ ] **Step 2: Commit**

```bash
git add src/extension.ts
git commit -m "refactor: generic extension host with no first-run import"
```

---

### Task 3: Update Profile Manager Panel (`src/profileManagerPanel.ts`)

**Files:**
- Modify: `src/profileManagerPanel.ts`

- [ ] **Step 1: Replace entire file content**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import stripJsonComments from 'strip-json-comments';
import { SettingProfile, loadProfiles, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';

export class ProfileManagerPanel {
  private static instance: ProfileManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private readonly _statusBarItem: vscode.StatusBarItem;
  private _disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem): void {
    if (ProfileManagerPanel.instance) {
      ProfileManagerPanel.instance._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'profileManager',
      'Settings Profiles',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    ProfileManagerPanel.instance = new ProfileManagerPanel(panel, context, statusBarItem);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    statusBarItem: vscode.StatusBarItem,
  ) {
    this._panel = panel;
    this._context = context;
    this._statusBarItem = statusBarItem;

    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      undefined,
      this._disposables,
    );

    this._panel.onDidDispose(() => {
      ProfileManagerPanel.instance = undefined;
      this._disposables.forEach((d) => d.dispose());
    });
  }

  private _getHtml(): string {
    const mediaDir = path.join(this._context.extensionPath, 'media');
    let html = fs.readFileSync(path.join(mediaDir, 'index.html'), 'utf8');

    const cssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaDir, 'style.css')),
    );
    const jsUri = this._panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this._context.extensionPath, 'out', 'webview', 'script.js')),
    );

    html = html.replace('{{CSS_URI}}', cssUri.toString());
    html = html.replace('{{JS_URI}}', jsUri.toString());

    return html;
  }

  private refresh(): void {
    const profiles = loadProfiles(this._context);
    const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
    this._panel.webview.postMessage({
      command: 'init',
      profiles,
      activeProfileName: activeName ?? null,
    });
  }

  private async _handleMessage(msg: { command: string; profile?: SettingProfile; profileName?: string; oldName?: string }) {
    switch (msg.command) {
      case 'ready':
        this.refresh();
        break;

      case 'save': {
        if (!msg.profile) return;
        const profiles = loadProfiles(this._context);
        const oldName: string | undefined = msg.oldName;
        const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
        const savingActiveProfile = oldName
          ? activeName === oldName
          : activeName === msg.profile.name;
        const idx = oldName
          ? profiles.findIndex(p => p.name === oldName)
          : profiles.findIndex(p => p.name === msg.profile!.name);
        if (idx >= 0) {
          profiles[idx] = msg.profile;
        } else {
          profiles.push(msg.profile);
        }
        if (savingActiveProfile) {
          await writeSetting(msg.profile.settingKey, msg.profile.value, getUserSettingsUri(this._context));
        }
        await this._context.globalState.update(PROFILES_KEY, profiles);
        if (savingActiveProfile && activeName !== msg.profile.name) {
          await this._context.globalState.update(SELECTED_PROFILE_KEY, msg.profile.name);
        }
        if (savingActiveProfile) {
          updateStatusBar(this._statusBarItem, msg.profile.name);
        }
        this.refresh();
        break;
      }

      case 'activate': {
        if (!msg.profileName) return;
        const profiles = loadProfiles(this._context);
        const profile = profiles.find(p => p.name === msg.profileName);
        if (!profile) return;
        await writeSetting(profile.settingKey, profile.value, getUserSettingsUri(this._context));
        await this._context.globalState.update(SELECTED_PROFILE_KEY, profile.name);
        updateStatusBar(this._statusBarItem, profile.name);
        this.refresh();

        const reload = await vscode.window.showInformationMessage(
          `Profile "${profile.name}" activated. Reload the window to apply changes to settings.json.`,
          'Reload Window',
        );
        if (reload === 'Reload Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        break;
      }

      case 'delete': {
        if (!msg.profileName) return;
        const confirm = await vscode.window.showWarningMessage(
          `Delete profile "${msg.profileName}"? This cannot be undone.`,
          { modal: true },
          'Delete',
        );
        if (confirm !== 'Delete') return;

        const profiles = loadProfiles(this._context);
        const idx = profiles.findIndex(p => p.name === msg.profileName);
        if (idx >= 0) {
          const removed = profiles.splice(idx, 1)[0];
          const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
          if (activeName === removed.name) {
            await clearSetting(removed.settingKey, getUserSettingsUri(this._context));
          }
          await this._context.globalState.update(PROFILES_KEY, profiles);
          if (activeName === removed.name) {
            await this._context.globalState.update(SELECTED_PROFILE_KEY, undefined);
            updateStatusBar(this._statusBarItem, undefined);
          }
        }
        this.refresh();
        break;
      }
    }
  }
}

// ── Status bar helper ─────────────────────────────────────

function updateStatusBar(item: vscode.StatusBarItem, profileName?: string) {
  if (profileName) {
    item.text = `$(account) ${profileName}`;
    item.tooltip = `Active profile: ${profileName}`;
    item.show();
  } else {
    item.hide();
  }
}

// ── Settings.json I/O via workspace.fs ──────────────────

export function getUserSettingsUri(context: vscode.ExtensionContext): vscode.Uri {
  const normalized = path.normalize(context.globalStorageUri.fsPath);
  const userDir = path.dirname(path.dirname(normalized));
  return vscode.Uri.file(path.join(userDir, 'settings.json'));
}

export async function readUserSettings(uri: vscode.Uri): Promise<Record<string, any>> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    return JSON.parse(stripJsonComments(text));
  } catch (err) {
    console.error('[ProfileManager] Read failed for:', uri.fsPath, err);
    return {};
  }
}

export function isRemote(): boolean {
  return vscode.env.remoteName !== undefined;
}

async function writeSetting(settingKey: string, value: any, settingsUri: vscode.Uri) {
  console.log('[ProfileManager] === WRITE START ===');
  console.log('[ProfileManager] Remote:', isRemote(), 'Target:', settingsUri.fsPath);
  console.log('[ProfileManager] Key:', settingKey, 'Value:', JSON.stringify(value));

  try {
    if (isRemote()) {
      console.log('[ProfileManager] Remote detected — using config.update');
      const config = vscode.workspace.getConfiguration();
      await config.update(settingKey, value, vscode.ConfigurationTarget.Global);
    } else {
      const settingsBefore = await readUserSettings(settingsUri);
      console.log('[ProfileManager] Settings BEFORE:', JSON.stringify(settingsBefore, null, 2));

      settingsBefore[settingKey] = value;

      const data = Buffer.from(JSON.stringify(settingsBefore, null, 4), 'utf8');
      await vscode.workspace.fs.writeFile(settingsUri, data);

      const verifyRaw = await vscode.workspace.fs.readFile(settingsUri);
      const verifyText = Buffer.from(verifyRaw).toString('utf8');
      const verify = JSON.parse(stripJsonComments(verifyText));
      console.log('[ProfileManager] Settings AFTER:', JSON.stringify(verify, null, 2));

      if (JSON.stringify(verify[settingKey]) === JSON.stringify(value)) {
        console.log('[ProfileManager] VERIFY: OK');
      } else {
        console.error('[ProfileManager] VERIFY: MISMATCH');
      }
    }
    console.log('[ProfileManager] === WRITE END ===');
  } catch (err) {
    console.error('[ProfileManager] Write failed:', err);
    throw err;
  }
}

async function clearSetting(settingKey: string, settingsUri: vscode.Uri) {
  console.log('[ProfileManager] === CLEAR START ===');
  console.log('[ProfileManager] Remote:', isRemote(), 'Target:', settingsUri.fsPath);
  console.log('[ProfileManager] Key:', settingKey);

  try {
    if (isRemote()) {
      console.log('[ProfileManager] Remote detected — using config.update');
      const config = vscode.workspace.getConfiguration();
      await config.update(settingKey, undefined, vscode.ConfigurationTarget.Global);
    } else {
      const settingsBefore = await readUserSettings(settingsUri);
      delete settingsBefore[settingKey];

      const data = Buffer.from(JSON.stringify(settingsBefore, null, 4), 'utf8');
      await vscode.workspace.fs.writeFile(settingsUri, data);

      const verifyRaw = await vscode.workspace.fs.readFile(settingsUri);
      const verifyText = Buffer.from(verifyRaw).toString('utf8');
      const verify = JSON.parse(stripJsonComments(verifyText));
      console.log('[ProfileManager] Settings AFTER:', JSON.stringify(verify, null, 2));

      if (!(settingKey in verify)) {
        console.log('[ProfileManager] VERIFY: OK');
      } else {
        console.error('[ProfileManager] VERIFY: MISMATCH');
      }
    }
    console.log('[ProfileManager] === CLEAR END ===');
  } catch (err) {
    console.error('[ProfileManager] Clear failed:', err);
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/profileManagerPanel.ts
git commit -m "refactor: generic writeSetting/clearSetting with dynamic keys"
```

---

### Task 4: Update Webview HTML (`media/index.html`)

**Files:**
- Modify: `media/index.html`

- [ ] **Step 1: Replace entire file content**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="{{CSS_URI}}">
</head>
<body>

<div class="layout">
  <div class="sidebar">
    <div class="sidebar-header">Profiles</div>
    <div class="profile-list" id="profileList"></div>
    <div class="sidebar-footer">
      <button id="newBtn">+ New Profile</button>
    </div>
  </div>

  <div class="editor">
    <div class="empty-editor" id="emptyState">
      Select a profile or create a new one
    </div>
    <div class="editor-content" id="editorContent">
      <div class="card">
        <div class="card-header">Profile</div>
        <div class="profile-header">
          <input type="text" id="profileName" placeholder="Profile name" />
          <span id="activeBadge" class="active-pill inactive">Not active</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Setting</div>
        <div class="form-row">
          <label for="settingKey">Setting Key</label>
          <input type="text" id="settingKey" placeholder="e.g. python.defaultInterpreterPath" />
        </div>
        <div class="form-row">
          <label for="settingValue">Value (JSON)</label>
          <textarea id="settingValue" rows="10" placeholder='"/usr/bin/python3.11"&#10;or&#10;[{ "name": "ANTHROPIC_BASE_URL", "value": "https://..." }]'></textarea>
          <div class="hint">Enter any valid JSON: strings need quotes, numbers and booleans do not.</div>
        </div>
      </div>

      <div class="actions">
        <button id="deleteBtn" class="btn" disabled>Delete</button>
        <span class="spacer"></span>
        <button id="saveBtn" class="btn">Save</button>
        <button id="activateBtn" class="btn" disabled>Activate</button>
      </div>
    </div>
  </div>
</div>

<script src="{{JS_URI}}"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add media/index.html
git commit -m "refactor: replace env var table with Setting Key + JSON Value editor"
```

---

### Task 5: Update Webview Script (`src/webview/script.ts`)

**Files:**
- Modify: `src/webview/script.ts`

- [ ] **Step 1: Replace entire file content**

```typescript
// ── VS Code: API shim ──────────────────────────────────────

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// ── Types ─────────────────────────────────────────────────

interface SettingProfile {
  name: string;
  settingKey: string;
  value: any;
}

interface InitMessage {
  command: 'init';
  profiles: SettingProfile[];
  activeProfileName: string | null;
}

type WebviewMessage = InitMessage;

// ── State ─────────────────────────────────────────────────

const vscode = acquireVsCodeApi();
let profiles: SettingProfile[] = [];
let activeProfileName: string | null = null;
let currentProfileName = '';
let originalProfileName = '';

// ── DOM refs ──────────────────────────────────────────────

const $ = (id: string) => document.getElementById(id)!;
const profileNameInput = $('profileName') as HTMLInputElement;
const settingKeyInput = $('settingKey') as HTMLInputElement;
const settingValueInput = $('settingValue') as HTMLTextAreaElement;

// ── Render helpers ────────────────────────────────────────

function loadProfile(profile: SettingProfile): void {
  currentProfileName = profile.name;
  originalProfileName = profile.name;
  profileNameInput.value = profile.name;
  settingKeyInput.value = profile.settingKey;
  settingValueInput.value = JSON.stringify(profile.value, null, 2);
  $('deleteBtn')!.disabled = false;
  $('activateBtn')!.disabled = false;
  $('emptyState')!.style.display = 'none';
  $('editorContent')!.classList.add('visible');
  rebuildSidebar(profile.name);
  updateBadge();
}

function rebuildSidebar(keepName: string): void {
  const list = $('profileList');
  list.textContent = '';
  profiles.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'profile-item' + (p.name === keepName ? ' active' : '');
    (div.dataset as DOMStringMap).name = p.name;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = p.name === activeProfileName ? '●' : '○';
    div.appendChild(dot);
    div.appendChild(document.createTextNode(p.name));
    list.appendChild(div);
  });
}

function updateBadge(): void {
  const b = $('activeBadge');
  const isActive = activeProfileName !== null && currentProfileName === activeProfileName;
  if (isActive) {
    b.textContent = '● Active';
    b.title = 'This profile is currently active';
    b.className = 'active-pill';
  } else {
    b.textContent = 'Not active';
    b.title = 'Click Activate to switch to this profile';
    b.className = 'active-pill inactive';
  }
}

function nextProfileName(): string {
  let max = 0;
  const re = /^profile-(\d+)$/;
  for (const p of profiles) {
    const m = p.name.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `profile-${max + 1}`;
}

function clearForm(): void {
  currentProfileName = '';
  originalProfileName = '';
  profileNameInput.value = '';
  settingKeyInput.value = '';
  settingValueInput.value = '';
  $('deleteBtn')!.disabled = true;
  $('activateBtn')!.disabled = true;
  $('emptyState')!.style.display = 'flex';
  $('editorContent')!.classList.remove('visible');
  rebuildSidebar('');
}

function handleInit(data: InitMessage): void {
  profiles = data.profiles || [];
  activeProfileName = data.activeProfileName;
  updateBadge();

  let keepName = currentProfileName;
  if (keepName && profiles.every((p) => p.name !== keepName)) {
    keepName = activeProfileName || (profiles.length > 0 ? profiles[0].name : '');
  }
  rebuildSidebar(keepName);

  if (keepName) {
    const p = profiles.find((p) => p.name === keepName);
    if (p) loadProfile(p);
  } else if (profiles.length > 0) {
    const first = activeProfileName
      ? profiles.find((p) => p.name === activeProfileName)
      : profiles[0];
    if (first) loadProfile(first);
  } else {
    clearForm();
  }
}

function validateProfile(): { ok: true; profile: SettingProfile } | { ok: false; error: string } {
  const name = profileNameInput.value.trim();
  if (!name) {
    profileNameInput.focus();
    return { ok: false, error: 'Profile name is required' };
  }

  const settingKey = settingKeyInput.value.trim();
  if (!settingKey) {
    settingKeyInput.focus();
    return { ok: false, error: 'Setting key is required' };
  }

  const valueText = settingValueInput.value.trim();
  let value: any;
  try {
    value = valueText ? JSON.parse(valueText) : undefined;
  } catch (e) {
    settingValueInput.focus();
    return { ok: false, error: `Invalid JSON value: ${e}` };
  }

  return { ok: true, profile: { name, settingKey, value } };
}

// ── Event: messages from extension ───────────────────────

window.addEventListener('message', (e) => {
  const msg = e.data as WebviewMessage;
  if (msg.command === 'init') {
    handleInit(msg);
  }
});

// ── Event: sidebar profile click ─────────────────────────

document.getElementById('profileList')!.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const item = el.closest('.profile-item') as HTMLElement | null;
  if (!item) return;
  const name = (item.dataset as DOMStringMap).name;
  const p = profiles.find((p) => p.name === name);
  if (p) loadProfile(p);
});

// ── Event: + New Profile button ──────────────────────────

document.getElementById('newBtn')!.addEventListener('click', () => {
  clearForm();
  $('emptyState')!.style.display = 'none';
  $('editorContent')!.classList.add('visible');
  const name = nextProfileName();
  profileNameInput.value = name;
  currentProfileName = name;
  originalProfileName = '';
  profileNameInput.focus();
  profileNameInput.select();
});

// ── Event: Delete button ─────────────────────────────────

document.getElementById('deleteBtn')!.addEventListener('click', () => {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'delete', profileName: currentProfileName });
});

// ── Event: Save ──────────────────────────────────────────

document.getElementById('saveBtn')!.addEventListener('click', () => {
  const result = validateProfile();
  if (!result.ok) {
    // Validation error is silent in UI; could show a toast here if desired
    return;
  }
  vscode.postMessage({
    command: 'save',
    profile: result.profile,
    oldName: originalProfileName,
  });
  currentProfileName = result.profile.name;
  originalProfileName = result.profile.name;
});

// ── Event: Activate ──────────────────────────────────────

document.getElementById('activateBtn')!.addEventListener('click', () => {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'activate', profileName: currentProfileName });
});

// ── Start: tell extension we're ready ────────────────────

vscode.postMessage({ command: 'ready' });
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/script.ts
git commit -m "refactor: webview UI for SettingProfile with JSON editor"
```

---

### Task 6: Update Package Manifest (`package.json`)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Apply changes**

Replace the following fields:

```json
  "name": "vscode-settings-profile-manager",
  "displayName": "VS Code: Settings Profile Manager",
  "description": "Manage multiple VS Code: setting profiles and switch between them without manually editing settings.json.",
```

Update `activationEvents`:

```json
  "activationEvents": [
    "onCommand:settingProfileManager.manageProfiles"
  ],
```

Update `contributes.commands`:

```json
    "commands": [
      {
        "command": "settingProfileManager.manageProfiles",
        "title": "Manage Profiles",
        "category": "Settings Profile"
      }
    ],
```

Remove the entire `configuration` array (both `claudeSettingManager` and `claudeCode` blocks).

The final `contributes` section should look like:

```json
  "contributes": {
    "commands": [
      {
        "command": "settingProfileManager.manageProfiles",
        "title": "Manage Profiles",
        "category": "Settings Profile"
      }
    ]
  },
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "refactor: generic package manifest and command IDs"
```

---

### Task 7: Update Tests

**Files:**
- Delete: `src/test/migration.test.ts`
- Delete: `src/test/importParser.test.ts`
- Delete: `src/test/envFilter.test.ts`
- Modify: `src/test/profileCrud.test.ts`

- [ ] **Step 1: Delete obsolete test files**

```bash
rm src/test/migration.test.ts src/test/importParser.test.ts src/test/envFilter.test.ts
git add -A
git commit -m "chore: remove obsolete tests for deleted features"
```

- [ ] **Step 2: Replace `src/test/profileCrud.test.ts`**

```typescript
import * as assert from 'assert';
import { SettingProfile } from '../types';

// ── Pure-logic extracts from ProfileManagerPanel ──────────

function upsertProfile(profiles: SettingProfile[], profile: SettingProfile, oldName?: string): SettingProfile[] {
  const idx = oldName
    ? profiles.findIndex(p => p.name === oldName)
    : profiles.findIndex(p => p.name === profile.name);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  return profiles;
}

function deleteProfile(profiles: SettingProfile[], name: string): SettingProfile[] {
  const idx = profiles.findIndex(p => p.name === name);
  if (idx >= 0) profiles.splice(idx, 1);
  return profiles;
}

function resolveActiveAfterDelete(profiles: SettingProfile[], activeName: string | undefined, deletedName: string): string | undefined {
  if (activeName === deletedName) return undefined;
  return activeName;
}

// ── Tests ─────────────────────────────────────────────────

const sampleProfile: SettingProfile = {
  name: 'prod',
  settingKey: 'claudeCode.environmentVariables',
  value: [{ name: 'ANTHROPIC_BASE_URL', value: 'https://api.example.com' }],
};

describe('Profile CRUD', () => {
  describe('upsertProfile', () => {
    it('appends a new profile', () => {
      const profiles: SettingProfile[] = [];
      const result = upsertProfile(profiles, sampleProfile);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'prod');
      assert.strictEqual(result[0].settingKey, 'claudeCode.environmentVariables');
    });

    it('updates an existing profile by name', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const updated: SettingProfile = { name: 'prod', settingKey: 'python.defaultInterpreterPath', value: '/usr/bin/python3' };
      const result = upsertProfile(profiles, updated);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].settingKey, 'python.defaultInterpreterPath');
      assert.strictEqual(result[0].value, '/usr/bin/python3');
    });

    it('updates by oldName when profile is renamed', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const renamed: SettingProfile = { name: 'production', settingKey: sampleProfile.settingKey, value: sampleProfile.value };
      const result = upsertProfile(profiles, renamed, 'prod');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'production');
    });

    it('does not duplicate when oldName matches an existing profile', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = upsertProfile(profiles, sampleProfile, 'prod');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('deleteProfile', () => {
    it('removes a profile by name', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = deleteProfile(profiles, 'prod');
      assert.strictEqual(result.length, 0);
    });

    it('does nothing when name not found', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = deleteProfile(profiles, 'nonexistent');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('resolveActiveAfterDelete', () => {
    it('clears active when deleted profile was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'prod', 'prod'), undefined);
    });

    it('keeps active when another profile was deleted', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'staging', 'prod'), 'staging');
    });

    it('keeps undefined when nothing was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], undefined, 'prod'), undefined);
    });
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/test/profileCrud.test.ts
git commit -m "test: update profile CRUD tests for SettingProfile"
```

---

### Task 8: Compile and Verify

- [ ] **Step 1: Compile TypeScript and webview**

```bash
npm run compile
```

Expected: No compilation errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit (if tests pass)**

```bash
git commit -m "chore: compile and verify all tests pass" --allow-empty
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| Data model: `SettingProfile` | Task 1 |
| Remove legacy types/migration | Task 1, Task 7 |
| Remove first-run import | Task 2 |
| Generic status bar | Task 2, Task 3 |
| Generic `writeSetting`/`clearSetting` | Task 3 |
| Webview: Setting Key input | Task 4 |
| Webview: JSON Value textarea | Task 4, Task 5 |
| Remove env var table/import | Task 4, Task 5 |
| JSON validation | Task 5 (validateProfile) |
| Generic package metadata | Task 6 |
| Remove Claude-specific config | Task 6 |
| Update tests | Task 7 |

All spec requirements covered.

### Placeholder Scan

- No TBD, TODO, or "implement later" found.
- All code blocks contain complete implementations.
- All test steps include actual test code.
- No vague instructions like "add appropriate error handling."

### Type Consistency

- `SettingProfile` used consistently across Tasks 1, 3, 5, 7.
- `PROFILES_KEY = 'settingProfiles'` and `SELECTED_PROFILE_KEY = 'selectedSettingProfile'` used in Tasks 1, 3.
- Command ID `settingProfileManager.manageProfiles` used in Tasks 2, 6.
