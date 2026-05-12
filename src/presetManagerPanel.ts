import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import stripJsonComments from 'strip-json-comments';
import { SettingPreset, loadPresets, PRESETS_KEY, SELECTED_PRESET_KEY } from './types';
import { upsertPreset, deletePreset, resolveActiveAfterDelete, resolveActiveAfterSave } from './lib/presetOps';

let log: vscode.OutputChannel | undefined;

export function setOutputChannel(channel: vscode.OutputChannel): void {
  log = channel;
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? `${err.name}: ${err.message}`;
  }
  return String(err);
}

function notifyError(operation: string, err: unknown): void {
  log?.appendLine(`[ERROR] ${operation} failed: ${formatError(err)}`);
  void vscode.window.showErrorMessage(
    `User Settings Presets: failed to ${operation}. See the "User Settings Presets" output channel for details.`,
  );
}

type IncomingMessage =
  | { command: 'ready' }
  | { command: 'save'; preset: SettingPreset; oldName?: string }
  | { command: 'apply'; presetName: string }
  | { command: 'delete'; presetName: string };

export class PresetManagerPanel {
  private static _instance: PresetManagerPanel | undefined;

  static get instance(): PresetManagerPanel | undefined {
    return PresetManagerPanel._instance;
  }
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext): void {
    if (PresetManagerPanel._instance) {
      PresetManagerPanel._instance._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'presetManager',
      'User Settings Presets',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'out', 'webview'),
        ],
      },
    );

    PresetManagerPanel._instance = new PresetManagerPanel(panel, context);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._context = context;

    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg as IncomingMessage),
      undefined,
      this._disposables,
    );

    this._panel.onDidDispose(() => {
      PresetManagerPanel._instance = undefined;
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
    const nonce = randomBytes(16).toString('hex');
    const cspSource = this._panel.webview.cspSource;

    html = html.replace('{{CSS_URI}}', cssUri.toString());
    html = html.replace('{{JS_URI}}', jsUri.toString());
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    html = html.replace(/\{\{CSP_SOURCE\}\}/g, cspSource);

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

  private async _handleMessage(msg: IncomingMessage): Promise<void> {
    switch (msg.command) {
      case 'ready':  this.handleReady();           return;
      case 'save':   await this.handleSave(msg);   return;
      case 'apply':  await this.handleApply(msg);  return;
      case 'delete': await this.handleDelete(msg); return;
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
        return;
      }
    }
  }

  public handleReady(): void {
    try {
      this.refresh();
    } catch (err) {
      notifyError('load presets', err);
    }
  }

  public async handleSave(msg: { preset: SettingPreset; oldName?: string }): Promise<void> {
    try {
      const presets = loadPresets(this._context);
      const activeName = this._context.globalState.get<string>(SELECTED_PRESET_KEY);

      const savingActivePreset = msg.oldName
        ? activeName === msg.oldName
        : activeName === msg.preset.name;

      if (savingActivePreset) {
        await writeSetting(msg.preset.settingKey, msg.preset.value, getUserSettingsUri(this._context));
      }

      const newPresets = upsertPreset(presets, msg.preset, msg.oldName);
      await this._context.globalState.update(PRESETS_KEY, newPresets);

      const newActiveName = resolveActiveAfterSave(activeName, msg.oldName, msg.preset.name);
      if (newActiveName !== activeName) {
        await this._context.globalState.update(SELECTED_PRESET_KEY, newActiveName);
      }
      this.refresh();
    } catch (err) {
      notifyError('save preset', err);
    }
  }

  public async handleApply(msg: { presetName: string }): Promise<void> {
    try {
      const presets = loadPresets(this._context);
      const preset = presets.find(p => p.name === msg.presetName);
      if (!preset) return;
      await writeSetting(preset.settingKey, preset.value, getUserSettingsUri(this._context));
      await this._context.globalState.update(SELECTED_PRESET_KEY, preset.name);
      this.refresh();

      const reload = await vscode.window.showInformationMessage(
        `Preset "${preset.name}" applied. Reload the window to apply changes to settings.json.`,
        'Reload Window',
      );
      if (reload === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } catch (err) {
      notifyError('apply preset', err);
    }
  }

  public async handleDelete(msg: { presetName: string }): Promise<void> {
    try {
      const confirm = await vscode.window.showWarningMessage(
        `Delete preset "${msg.presetName}"? This cannot be undone.`,
        { modal: true },
        'Delete',
      );
      if (confirm !== 'Delete') return;

      const presets = loadPresets(this._context);
      const preset = presets.find(p => p.name === msg.presetName);
      if (!preset) return;

      const activeName: string | undefined = this._context.globalState.get(SELECTED_PRESET_KEY);
      const wasActive = activeName === preset.name;

      if (wasActive) {
        await clearSetting(preset.settingKey, getUserSettingsUri(this._context));
      }

      const newPresets = deletePreset(presets, msg.presetName);
      await this._context.globalState.update(PRESETS_KEY, newPresets);

      const newActiveName = resolveActiveAfterDelete(activeName, msg.presetName);
      if (newActiveName !== activeName) {
        await this._context.globalState.update(SELECTED_PRESET_KEY, newActiveName);
      }
      this.refresh();
    } catch (err) {
      notifyError('delete preset', err);
    }
  }
}

// ── Settings.json I/O via workspace.fs ──────────────────

export function getUserSettingsUri(context: vscode.ExtensionContext): vscode.Uri {
  const normalized = path.normalize(context.globalStorageUri.fsPath);
  const userDir = path.dirname(path.dirname(normalized));
  return vscode.Uri.file(path.join(userDir, 'settings.json'));
}

export async function readUserSettings(uri: vscode.Uri): Promise<Record<string, unknown>> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    return JSON.parse(stripJsonComments(text));
  } catch (err) {
    log?.appendLine(`[ERROR] Read failed for ${uri.fsPath}: ${formatError(err)}`);
    return {};
  }
}

export function isRemote(): boolean {
  return vscode.env.remoteName !== undefined;
}

async function writeSetting(settingKey: string, value: unknown, settingsUri: vscode.Uri) {
  log?.appendLine('=== WRITE START ===');
  log?.appendLine(`Remote: ${isRemote()}  Target: ${settingsUri.fsPath}`);
  log?.appendLine(`Key: ${settingKey}  Value: ${JSON.stringify(value)}`);

  try {
    if (isRemote()) {
      log?.appendLine('Remote detected — using config.update');
      const config = vscode.workspace.getConfiguration();
      await config.update(settingKey, value, vscode.ConfigurationTarget.Global);
    } else {
      const settingsBefore = await readUserSettings(settingsUri);
      log?.appendLine(`Settings BEFORE: ${JSON.stringify(settingsBefore, null, 2)}`);

      settingsBefore[settingKey] = value;

      const data = Buffer.from(JSON.stringify(settingsBefore, null, 4), 'utf8');
      await vscode.workspace.fs.writeFile(settingsUri, data);

      const verifyRaw = await vscode.workspace.fs.readFile(settingsUri);
      const verifyText = Buffer.from(verifyRaw).toString('utf8');
      const verify = JSON.parse(stripJsonComments(verifyText));
      log?.appendLine(`Settings AFTER: ${JSON.stringify(verify, null, 2)}`);

      if (JSON.stringify(verify[settingKey]) === JSON.stringify(value)) {
        log?.appendLine('VERIFY: OK');
      } else {
        log?.appendLine('[ERROR] VERIFY: MISMATCH');
      }
    }
    log?.appendLine('=== WRITE END ===');
  } catch (err) {
    log?.appendLine(`[ERROR] Write failed: ${formatError(err)}`);
    throw err;
  }
}

async function clearSetting(settingKey: string, settingsUri: vscode.Uri) {
  log?.appendLine('=== CLEAR START ===');
  log?.appendLine(`Remote: ${isRemote()}  Target: ${settingsUri.fsPath}`);
  log?.appendLine(`Key: ${settingKey}`);

  try {
    if (isRemote()) {
      log?.appendLine('Remote detected — using config.update');
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
      log?.appendLine(`Settings AFTER: ${JSON.stringify(verify, null, 2)}`);

      if (!(settingKey in verify)) {
        log?.appendLine('VERIFY: OK');
      } else {
        log?.appendLine('[ERROR] VERIFY: MISMATCH');
      }
    }
    log?.appendLine('=== CLEAR END ===');
  } catch (err) {
    log?.appendLine(`[ERROR] Clear failed: ${formatError(err)}`);
    throw err;
  }
}
