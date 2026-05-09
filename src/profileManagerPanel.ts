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
