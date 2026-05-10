import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import stripJsonComments from 'strip-json-comments';
import { SettingPreset, loadPresets, PRESETS_KEY, SELECTED_PRESET_KEY } from './types';

export class PresetManagerPanel {
  private static instance: PresetManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private readonly _statusBarItem: vscode.StatusBarItem;
  private _disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem): void {
    if (PresetManagerPanel.instance) {
      PresetManagerPanel.instance._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'presetManager',
      'User Settings Presets',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    PresetManagerPanel.instance = new PresetManagerPanel(panel, context, statusBarItem);
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
      PresetManagerPanel.instance = undefined;
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
    const presets = loadPresets(this._context);
    const activeName: string | undefined = this._context.globalState.get(SELECTED_PRESET_KEY);
    this._panel.webview.postMessage({
      command: 'init',
      presets,
      activePresetName: activeName ?? null,
    });
  }

  private async _handleMessage(msg: { command: string; preset?: SettingPreset; presetName?: string; oldName?: string }) {
    switch (msg.command) {
      case 'ready':
        this.refresh();
        break;

      case 'save': {
        if (!msg.preset) return;
        const presets = loadPresets(this._context);
        const oldName: string | undefined = msg.oldName;
        const activeName: string | undefined = this._context.globalState.get(SELECTED_PRESET_KEY);
        const savingActivePreset = oldName
          ? activeName === oldName
          : activeName === msg.preset.name;
        const idx = oldName
          ? presets.findIndex(p => p.name === oldName)
          : presets.findIndex(p => p.name === msg.preset!.name);
        if (idx >= 0) {
          presets[idx] = msg.preset;
        } else {
          presets.push(msg.preset);
        }
        if (savingActivePreset) {
          await writeSetting(msg.preset.settingKey, msg.preset.value, getUserSettingsUri(this._context));
        }
        await this._context.globalState.update(PRESETS_KEY, presets);
        if (savingActivePreset && activeName !== msg.preset.name) {
          await this._context.globalState.update(SELECTED_PRESET_KEY, msg.preset.name);
        }
        if (savingActivePreset) {
          updateStatusBar(this._statusBarItem, msg.preset.name);
        }
        this.refresh();
        break;
      }

      case 'activate': {
        if (!msg.presetName) return;
        const presets = loadPresets(this._context);
        const preset = presets.find(p => p.name === msg.presetName);
        if (!preset) return;
        await writeSetting(preset.settingKey, preset.value, getUserSettingsUri(this._context));
        await this._context.globalState.update(SELECTED_PRESET_KEY, preset.name);
        updateStatusBar(this._statusBarItem, preset.name);
        this.refresh();

        const reload = await vscode.window.showInformationMessage(
          `Preset "${preset.name}" applied. Reload the window to apply changes to settings.json.`,
          'Reload Window',
        );
        if (reload === 'Reload Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        break;
      }

      case 'delete': {
        if (!msg.presetName) return;
        const confirm = await vscode.window.showWarningMessage(
          `Delete preset "${msg.presetName}"? This cannot be undone.`,
          { modal: true },
          'Delete',
        );
        if (confirm !== 'Delete') return;

        const presets = loadPresets(this._context);
        const idx = presets.findIndex(p => p.name === msg.presetName);
        if (idx >= 0) {
          const removed = presets.splice(idx, 1)[0];
          const activeName: string | undefined = this._context.globalState.get(SELECTED_PRESET_KEY);
          if (activeName === removed.name) {
            await clearSetting(removed.settingKey, getUserSettingsUri(this._context));
          }
          await this._context.globalState.update(PRESETS_KEY, presets);
          if (activeName === removed.name) {
            await this._context.globalState.update(SELECTED_PRESET_KEY, undefined);
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

function updateStatusBar(item: vscode.StatusBarItem, presetName?: string) {
  if (presetName) {
    item.text = `$(account) ${presetName}`;
    item.tooltip = `Active preset: ${presetName}`;
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
    console.error('[PresetManager] Read failed for:', uri.fsPath, err);
    return {};
  }
}

export function isRemote(): boolean {
  return vscode.env.remoteName !== undefined;
}

async function writeSetting(settingKey: string, value: any, settingsUri: vscode.Uri) {
  console.log('[PresetManager] === WRITE START ===');
  console.log('[PresetManager] Remote:', isRemote(), 'Target:', settingsUri.fsPath);
  console.log('[PresetManager] Key:', settingKey, 'Value:', JSON.stringify(value));

  try {
    if (isRemote()) {
      console.log('[PresetManager] Remote detected — using config.update');
      const config = vscode.workspace.getConfiguration();
      await config.update(settingKey, value, vscode.ConfigurationTarget.Global);
    } else {
      const settingsBefore = await readUserSettings(settingsUri);
      console.log('[PresetManager] Settings BEFORE:', JSON.stringify(settingsBefore, null, 2));

      settingsBefore[settingKey] = value;

      const data = Buffer.from(JSON.stringify(settingsBefore, null, 4), 'utf8');
      await vscode.workspace.fs.writeFile(settingsUri, data);

      const verifyRaw = await vscode.workspace.fs.readFile(settingsUri);
      const verifyText = Buffer.from(verifyRaw).toString('utf8');
      const verify = JSON.parse(stripJsonComments(verifyText));
      console.log('[PresetManager] Settings AFTER:', JSON.stringify(verify, null, 2));

      if (JSON.stringify(verify[settingKey]) === JSON.stringify(value)) {
        console.log('[PresetManager] VERIFY: OK');
      } else {
        console.error('[PresetManager] VERIFY: MISMATCH');
      }
    }
    console.log('[PresetManager] === WRITE END ===');
  } catch (err) {
    console.error('[PresetManager] Write failed:', err);
    throw err;
  }
}

async function clearSetting(settingKey: string, settingsUri: vscode.Uri) {
  console.log('[PresetManager] === CLEAR START ===');
  console.log('[PresetManager] Remote:', isRemote(), 'Target:', settingsUri.fsPath);
  console.log('[PresetManager] Key:', settingKey);

  try {
    if (isRemote()) {
      console.log('[PresetManager] Remote detected — using config.update');
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
      console.log('[PresetManager] Settings AFTER:', JSON.stringify(verify, null, 2));

      if (!(settingKey in verify)) {
        console.log('[PresetManager] VERIFY: OK');
      } else {
        console.error('[PresetManager] VERIFY: MISMATCH');
      }
    }
    console.log('[PresetManager] === CLEAR END ===');
  } catch (err) {
    console.error('[PresetManager] Clear failed:', err);
    throw err;
  }
}
