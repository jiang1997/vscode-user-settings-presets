import * as vscode from 'vscode';
import { ApiProfile, EnvVar } from './types';

export class ProfileEditorPanel {
  private static currentPanel: ProfileEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _resolve?: (profile: ApiProfile | undefined) => void;

  static async show(
    context: vscode.ExtensionContext,
    existingProfile?: ApiProfile,
  ): Promise<ApiProfile | undefined> {
    ProfileEditorPanel.currentPanel?._panel.dispose();

    return new Promise<ApiProfile | undefined>((resolve) => {
      const panel = vscode.window.createWebviewPanel(
        'profileEditor',
        existingProfile ? `Edit: ${existingProfile.name}` : 'Add Profile',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true },
      );

      ProfileEditorPanel.currentPanel = new ProfileEditorPanel(
        panel, resolve, existingProfile,
      );
    });
  }

  private constructor(
    panel: vscode.WebviewPanel,
    resolve: (profile: ApiProfile | undefined) => void,
    existingProfile?: ApiProfile,
  ) {
    this._panel = panel;
    this._resolve = resolve;

    this._panel.webview.html = buildHtml(existingProfile);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      undefined,
      this._disposables,
    );

    this._panel.onDidDispose(() => {
      ProfileEditorPanel.currentPanel = undefined;
      if (this._resolve) {
        this._resolve(undefined);
        this._resolve = undefined;
      }
      this._disposables.forEach((d) => d.dispose());
    });
  }

  private _handleMessage(message: { command: string; profile?: ApiProfile }) {
    switch (message.command) {
      case 'save':
        if (this._resolve && message.profile) {
          this._resolve(message.profile);
          this._resolve = undefined;
        }
        this._panel.dispose();
        break;
      case 'cancel':
        if (this._resolve) {
          this._resolve(undefined);
          this._resolve = undefined;
        }
        this._panel.dispose();
        break;
    }
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function buildHtml(existing?: ApiProfile): string {
  const profileName = esc(existing?.name ?? '');
  const defaultVars: EnvVar[] = [
    { name: 'ANTHROPIC_BASE_URL', value: '' },
    { name: 'ANTHROPIC_AUTH_TOKEN', value: '' },
    { name: 'ANTHROPIC_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: '' },
  ];
  const envVars = existing?.envVars ?? defaultVars;
  const envVarsJson = JSON.stringify(envVars);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    padding: 20px 24px;
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family);
    font-size: 13px;
  }
  .section { margin-bottom: 20px; }
  label {
    display: block; margin-bottom: 4px; font-weight: 600;
    color: var(--vscode-foreground);
  }
  .ev-name, .ev-value, #profileName {
    width: 100%;
    padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 2px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 13px;
  }
  input:focus {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -1px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th {
    text-align: left; font-weight: 500; font-size: 12px;
    padding: 4px 6px 6px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  th.act { width: 36px; }
  td { padding: 3px 3px; vertical-align: middle; }
  td.nm { width: 32%; }
  td.vl { width: calc(68% - 36px); }
  td.act { width: 36px; text-align: center; }
  .rbtn {
    background: none; border: none; cursor: pointer;
    font-size: 16px; padding: 2px 5px; border-radius: 2px; line-height: 1;
  }
  .rbtn.del { color: var(--vscode-errorForeground); }
  .rbtn.del:hover { background: var(--vscode-toolbar-hoverBackground); }
  #addRow {
    background: none; border: 1px dashed var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground); cursor: pointer;
    padding: 5px 12px; font-size: 12px; border-radius: 2px; width: 100%;
  }
  #addRow:hover { background: var(--vscode-toolbar-hoverBackground); }
  #importArea {
    width: 100%; margin-top: 6px; padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 2px; font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px; resize: vertical;
  }
  #importBtn {
    margin-top: 4px; margin-bottom: 8px;
    padding: 3px 12px; background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none; border-radius: 2px; font-size: 12px; cursor: pointer;
  }
  #importBtn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .actions {
    display: flex; justify-content: flex-end; gap: 8px;
    margin-top: 24px; padding-top: 16px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  .btn {
    padding: 5px 16px; border-radius: 2px; font-size: 13px;
    cursor: pointer; border: 1px solid transparent;
  }
  #save {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  #save:hover { background: var(--vscode-button-hoverBackground); }
  #cancel {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  #cancel:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>

<div class="section">
  <label for="profileName">Profile Name</label>
  <input type="text" id="profileName" value="${profileName}"
         placeholder="e.g. production, staging" autofocus />
</div>

<div class="section">
  <label>Environment Variables</label>
  <table>
    <thead>
      <tr><th>Name</th><th>Value</th><th class="act"></th></tr>
    </thead>
    <tbody id="envBody"></tbody>
  </table>
  <details>
    <summary>Import from bash</summary>
    <textarea id="importArea" rows="6" placeholder="Paste export lines, one per line:&#10;export VAR_NAME=value&#10;export ANTHROPIC_BASE_URL=https://..."></textarea>
    <button id="importBtn">Import</button>
  </details>
  <button id="addRow">+ Add Variable</button>
</div>

<div class="actions">
  <button id="cancel" class="btn">Cancel</button>
  <button id="save" class="btn">Save Profile</button>
</div>

<script>
var vscode = acquireVsCodeApi();
var rows = /** @type {{name:string,value:string}[]} */ (${envVarsJson});

function render() {
  var body = document.getElementById('envBody');
  body.textContent = '';
  rows.forEach(function(r, i) {
    var tr = document.createElement('tr');

    var tdName = document.createElement('td');
    tdName.className = 'nm';
    var inpName = document.createElement('input');
    inpName.type = 'text';
    inpName.className = 'ev-name';
    inpName.value = r.name;
    inpName.placeholder = 'VAR_NAME';
    inpName.dataset.idx = String(i);
    tdName.appendChild(inpName);

    var tdVal = document.createElement('td');
    tdVal.className = 'vl';
    var inpVal = document.createElement('input');
    inpVal.type = r.name === 'ANTHROPIC_AUTH_TOKEN' ? 'password' : 'text';
    inpVal.className = 'ev-value';
    inpVal.value = r.value;
    inpVal.dataset.idx = String(i);
    tdVal.appendChild(inpVal);

    var tdDel = document.createElement('td');
    tdDel.className = 'act';
    var btnDel = document.createElement('button');
    btnDel.className = 'rbtn del';
    btnDel.textContent = '\\u2715';
    btnDel.title = 'Remove';
    btnDel.dataset.idx = String(i);
    tdDel.appendChild(btnDel);

    tr.appendChild(tdName);
    tr.appendChild(tdVal);
    tr.appendChild(tdDel);
    body.appendChild(tr);
  });
  if (rows.length > 0 && !rows[rows.length - 1].name) {
    var last = body.querySelector('.ev-name:last-of-type');
    if (last) last.focus();
  }
}

function collect() {
  var names = document.querySelectorAll('.ev-name');
  var values = document.querySelectorAll('.ev-value');
  var result = [];
  for (var i = 0; i < names.length; i++) {
    var n = names[i].value.trim();
    if (n) result.push({ name: n, value: values[i].value });
  }
  return result;
}

document.getElementById('addRow').addEventListener('click', function() {
  rows.push({ name: '', value: '' });
  render();
});

document.getElementById('importBtn').addEventListener('click', function() {
  var text = document.getElementById('importArea').value;
  if (!text.trim()) return;
  var lines = text.split(/\\r?\\n/);
  var imported = 0;
  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) return;
    var m = trimmed.match(/^(?:export\\s+)?(\\w+)=(.+)$/);
    if (!m) return;
    var found = false;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].name === m[1]) {
        rows[i].value = m[2];
        found = true;
        break;
      }
    }
    if (!found) {
      rows.push({ name: m[1], value: m[2] });
    }
    imported++;
  });
  document.getElementById('importArea').value = '';
  render();
});

document.getElementById('envBody').addEventListener('input', function(e) {
  var el = /** @type {HTMLInputElement} */ (e.target);
  var idx = parseInt(el.dataset.idx);
  if (isNaN(idx) || !rows[idx]) return;
  rows[idx][el.classList.contains('ev-name') ? 'name' : 'value'] = el.value;
});

document.getElementById('envBody').addEventListener('click', function(e) {
  var btn = /** @type {HTMLElement} */ (e.target);
  if (!btn.classList.contains('del')) return;
  var idx = parseInt(btn.dataset.idx);
  rows.splice(idx, 1);
  render();
});

document.getElementById('save').addEventListener('click', function() {
  var name = document.getElementById('profileName').value.trim();
  if (!name) { document.getElementById('profileName').focus(); return; }
  vscode.postMessage({ command: 'save', profile: { name: name, envVars: collect() } });
});

document.getElementById('cancel').addEventListener('click', function() {
  vscode.postMessage({ command: 'cancel' });
});

render();
</script>
</body>
</html>`;
}
