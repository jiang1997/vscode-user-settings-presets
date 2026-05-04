import * as vscode from 'vscode';
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
      'Claude Profiles',
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

    this._panel.webview.html = buildHtml();

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

  private refresh(): void {
    const profiles = loadProfiles(this._context);
    const activeName: string | undefined = this._context.globalState.get(SELECTED_PROFILE_KEY);
    this._panel.webview.postMessage({
      command: 'init',
      profiles,
      activeProfileName: activeName ?? null,
    });
  }

  private async _handleMessage(msg: { command: string; profile?: ApiProfile; profileName?: string }) {
    switch (msg.command) {
      case 'ready':
        this.refresh();
        break;

      case 'save': {
        if (!msg.profile) return;
        const profiles = loadProfiles(this._context);
        const idx = profiles.findIndex(p => p.name === msg.profile!.name);
        if (idx >= 0) {
          profiles[idx] = msg.profile;
        } else {
          profiles.push(msg.profile);
        }
        await this._context.globalState.update(PROFILES_KEY, profiles);
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

// ── Webview HTML / JS ─────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function buildHtml(): string {
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
  .badge {
    display: inline-block; padding: 2px 10px; border-radius: 10px;
    font-size: 12px; font-weight: 600; margin-bottom: 16px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .badge.inactive { opacity: 0.5; }
  .section { margin-bottom: 16px; }
  label {
    display: block; margin-bottom: 4px; font-weight: 600;
    color: var(--vscode-foreground);
  }
  .toolbar {
    display: flex; gap: 8px; align-items: center; margin-bottom: 16px;
  }
  .toolbar select {
    flex: 1; padding: 5px 8px;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 2px; font-family: var(--vscode-font-family); font-size: 13px;
  }
  .toolbar button {
    padding: 5px 12px; border-radius: 2px; font-size: 12px;
    cursor: pointer; border: none; white-space: nowrap;
  }
  #newBtn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  #newBtn:hover { background: var(--vscode-button-hoverBackground); }
  #deleteBtn {
    background: none; border: 1px solid var(--vscode-errorForeground);
    color: var(--vscode-errorForeground);
  }
  #deleteBtn:hover { background: var(--vscode-toolbar-hoverBackground); }
  #deleteBtn:disabled, #activateBtn:disabled { opacity: 0.4; cursor: default; }
  .ev-name, .ev-value, #profileName {
    width: 100%; padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 2px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 13px;
  }
  input:focus, select:focus {
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
  #saveBtn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  #saveBtn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  #activateBtn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  #activateBtn:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>

<div id="activeBadge" class="badge inactive">No active profile</div>

<div class="section">
  <label>Profile</label>
  <div class="toolbar">
    <select id="profileSelect">
      <option value="">-- Select a profile --</option>
    </select>
    <button id="newBtn">+ New</button>
    <button id="deleteBtn" disabled>Delete</button>
  </div>
</div>

<div class="section">
  <label for="profileName">Profile Name</label>
  <input type="text" id="profileName" placeholder="e.g. production, staging" />
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
    <textarea id="importArea" rows="6" placeholder="Paste export lines, one per line line"></textarea>
    <button id="importBtn">Import</button>
  </details>
  <button id="addRow">+ Add Variable</button>
</div>

<div class="actions">
  <button id="saveBtn" class="btn">Save</button>
  <button id="activateBtn" class="btn" disabled>Activate</button>
</div>

<script>
var vscode = acquireVsCodeApi();
var profiles = [];
var activeProfileName = null;
var rows = [];
var currentProfileName = '';

// ── Render env var table ────────────────────────────────
function renderTable() {
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
}

// ── Collect form data ────────────────────────────────────
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

// ── Load profile into form ───────────────────────────────
function loadProfile(profile) {
  currentProfileName = profile.name;
  document.getElementById('profileName').value = profile.name;
  rows = profile.envVars.map(function(ev) {
    return { name: ev.name, value: ev.value };
  });
  renderTable();
  document.getElementById('deleteBtn').disabled = false;
  document.getElementById('activateBtn').disabled = false;
}

// ── Default template vars ────────────────────────────────
function defaultVars() {
  return [
    { name: 'ANTHROPIC_BASE_URL', value: '' },
    { name: 'ANTHROPIC_AUTH_TOKEN', value: '' },
    { name: 'ANTHROPIC_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: '' },
  ];
}

// ── Rebuild dropdown from profiles list ──────────────────
function rebuildSelect(keepName) {
  var sel = document.getElementById('profileSelect');
  sel.textContent = '';
  var opt = document.createElement('option');
  opt.value = '';
  opt.textContent = '-- Select a profile --';
  sel.appendChild(opt);
  var found = false;
  profiles.forEach(function(p) {
    opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name + (p.name === activeProfileName ? ' (active)' : '');
    sel.appendChild(opt);
    if (p.name === keepName) found = true;
  });
  sel.value = found ? keepName : '';
}

// ── Update active badge ──────────────────────────────────
function updateBadge() {
  var b = document.getElementById('activeBadge');
  if (activeProfileName) {
    b.textContent = '\\u25cf Active: ' + activeProfileName;
    b.className = 'badge';
  } else {
    b.textContent = 'No active profile';
    b.className = 'badge inactive';
  }
}

// ── Handle init from extension ───────────────────────────
function handleInit(data) {
  profiles = data.profiles || [];
  activeProfileName = data.activeProfileName;
  updateBadge();

  // Preserve current selection if still valid
  var keepName = currentProfileName;
  if (keepName && profiles.every(function(p) { return p.name !== keepName; })) {
    // currently selected profile was deleted
    keepName = activeProfileName || (profiles.length > 0 ? profiles[0].name : '');
  }
  rebuildSelect(keepName);

  if (keepName) {
    var p = profiles.find(function(p) { return p.name === keepName; });
    if (p) loadProfile(p);
  } else if (profiles.length > 0) {
    // auto-select the active profile or first one
    var first = activeProfileName
      ? profiles.find(function(p) { return p.name === activeProfileName; })
      : profiles[0];
    if (first) loadProfile(first);
  } else {
    // no profiles at all
    clearForm();
  }
}

// ── Clear the form ───────────────────────────────────────
function clearForm() {
  currentProfileName = '';
  document.getElementById('profileName').value = '';
  rows = defaultVars();
  renderTable();
  document.getElementById('deleteBtn').disabled = true;
  document.getElementById('activateBtn').disabled = true;
  document.getElementById('profileSelect').value = '';
}

// ── Event: messages from extension ───────────────────────
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.command === 'init') {
    handleInit(msg);
  }
});

// ── Event: dropdown change ───────────────────────────────
document.getElementById('profileSelect').addEventListener('change', function() {
  var name = this.value;
  if (!name) { clearForm(); return; }
  var p = profiles.find(function(p) { return p.name === name; });
  if (p) loadProfile(p);
});

// ── Event: + New button ──────────────────────────────────
document.getElementById('newBtn').addEventListener('click', function() {
  clearForm();
  document.getElementById('profileName').focus();
});

// ── Event: Delete button ─────────────────────────────────
document.getElementById('deleteBtn').addEventListener('click', function() {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'delete', profileName: currentProfileName });
});

// ── Event: Env table input changes ───────────────────────
document.getElementById('envBody').addEventListener('input', function(e) {
  var el = /** @type {HTMLInputElement} */ (e.target);
  var idx = parseInt(el.dataset.idx);
  if (isNaN(idx) || !rows[idx]) return;
  rows[idx][el.classList.contains('ev-name') ? 'name' : 'value'] = el.value;
});

// ── Event: Env table delete row ──────────────────────────
document.getElementById('envBody').addEventListener('click', function(e) {
  var btn = /** @type {HTMLElement} */ (e.target);
  if (!btn.classList.contains('del')) return;
  var idx = parseInt(btn.dataset.idx);
  rows.splice(idx, 1);
  renderTable();
});

// ── Event: Add variable row ──────────────────────────────
document.getElementById('addRow').addEventListener('click', function() {
  rows.push({ name: '', value: '' });
  renderTable();
});

// ── Event: Import from bash ──────────────────────────────
document.getElementById('importBtn').addEventListener('click', function() {
  var text = document.getElementById('importArea').value;
  if (!text.trim()) return;
  var lines = text.split(/\\r?\\n/);
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
    if (!found) rows.push({ name: m[1], value: m[2] });
  });
  document.getElementById('importArea').value = '';
  renderTable();
});

// ── Event: Save ──────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', function() {
  var name = document.getElementById('profileName').value.trim();
  if (!name) { document.getElementById('profileName').focus(); return; }
  vscode.postMessage({ command: 'save', profile: { name: name, envVars: collect() } });
});

// ── Event: Activate ──────────────────────────────────────
document.getElementById('activateBtn').addEventListener('click', function() {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'activate', profileName: currentProfileName });
});

// ── Start: tell extension we're ready ────────────────────
renderTable();
vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
}
