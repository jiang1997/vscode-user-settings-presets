import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ApiProfile, EnvVar, loadProfiles, PROFILES_KEY, SELECTED_PROFILE_KEY } from './types';

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
      'Claude Code Profiles',
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

  private async _handleMessage(msg: { command: string; profile?: ApiProfile; profileName?: string; oldName?: string }) {
    switch (msg.command) {
      case 'ready':
        this.refresh();
        break;

      case 'save': {
        if (!msg.profile) return;
        const profiles = loadProfiles(this._context);
        const oldName: string | undefined = msg.oldName;
        const idx = oldName
          ? profiles.findIndex(p => p.name === oldName)
          : profiles.findIndex(p => p.name === msg.profile!.name);
        if (idx >= 0) {
          profiles[idx] = msg.profile;
        } else {
          profiles.push(msg.profile);
        }
        await this._context.globalState.update(PROFILES_KEY, profiles);
        if (oldName && oldName !== msg.profile.name) {
          const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
          if (activeName === oldName) {
            await this._context.globalState.update(SELECTED_PROFILE_KEY, msg.profile.name);
            updateStatusBar(this._statusBarItem, msg.profile.name);
          }
        }
        this.refresh();
        break;
      }

      case 'activate': {
        if (!msg.profileName) return;
        const profiles = loadProfiles(this._context);
        const profile = profiles.find(p => p.name === msg.profileName);
        if (!profile) return;
        await this._context.globalState.update(SELECTED_PROFILE_KEY, profile.name);
        writeEnvVars(profile.envVars);
        updateStatusBar(this._statusBarItem, profile.name);
        this.refresh();
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
          await this._context.globalState.update(PROFILES_KEY, profiles);
          const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
          if (activeName === removed.name) {
            await this._context.globalState.update(SELECTED_PROFILE_KEY, undefined);
            clearEnvVars();
            updateStatusBar(this._statusBarItem, undefined);
          }
        }
        this.refresh();
        break;
      }
    }
  }
}

// ── Module-level helpers (moved from extension.ts) ────────

function updateStatusBar(item: vscode.StatusBarItem, profileName?: string) {
  if (profileName) {
    item.text = `$(account) ${profileName}`;
    item.tooltip = `Active Claude API profile: ${profileName}`;
    item.show();
  } else {
    item.hide();
  }
}

async function writeEnvVars(envVars: EnvVar[]) {
  const config = vscode.workspace.getConfiguration('claudeCode');
  const filled = envVars.filter(e => e.value !== '');
  await config.update('environmentVariables', filled, vscode.ConfigurationTarget.Global);
}

async function clearEnvVars() {
  const config = vscode.workspace.getConfiguration('claudeCode');
  await config.update('environmentVariables', [], vscode.ConfigurationTarget.Global);
}
