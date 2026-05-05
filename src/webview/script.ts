// ── VS Code API shim ──────────────────────────────────────

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// ── Types ─────────────────────────────────────────────────

interface EnvVar {
  name: string;
  value: string;
}

interface ApiProfile {
  name: string;
  envVars: EnvVar[];
}

interface InitMessage {
  command: 'init';
  profiles: ApiProfile[];
  activeProfileName: string | null;
}

type WebviewMessage = InitMessage;

// ── State ─────────────────────────────────────────────────

const vscode = acquireVsCodeApi();
let profiles: ApiProfile[] = [];
let activeProfileName: string | null = null;
let rows: EnvVar[] = [];
let currentProfileName = '';
let originalProfileName = '';

// ── Render env var table ─────────────────────────────────

function renderTable(): void {
  const body = document.getElementById('envBody')!;
  body.textContent = '';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.className = 'nm';
    const inpName = document.createElement('input');
    inpName.type = 'text';
    inpName.className = 'ev-name';
    inpName.value = r.name;
    inpName.placeholder = 'VAR_NAME';
    (inpName.dataset as DOMStringMap).idx = String(i);
    tdName.appendChild(inpName);

    const tdVal = document.createElement('td');
    tdVal.className = 'vl';
    const inpVal = document.createElement('input');
    inpVal.type = r.name === 'ANTHROPIC_AUTH_TOKEN' ? 'password' : 'text';
    inpVal.className = 'ev-value';
    inpVal.value = r.value;
    (inpVal.dataset as DOMStringMap).idx = String(i);
    tdVal.appendChild(inpVal);

    const tdDel = document.createElement('td');
    tdDel.className = 'act';
    const btnDel = document.createElement('button');
    btnDel.className = 'rbtn del';
    btnDel.textContent = '✕';
    btnDel.title = 'Remove';
    (btnDel.dataset as DOMStringMap).idx = String(i);
    tdDel.appendChild(btnDel);

    tr.appendChild(tdName);
    tr.appendChild(tdVal);
    tr.appendChild(tdDel);
    body.appendChild(tr);
  });
}

// ── Collect form data ────────────────────────────────────

function collect(): EnvVar[] {
  const names = document.querySelectorAll<HTMLInputElement>('.ev-name');
  const values = document.querySelectorAll<HTMLInputElement>('.ev-value');
  const result: EnvVar[] = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i].value.trim();
    if (n) result.push({ name: n, value: values[i].value });
  }
  return result;
}

// ── Load profile into form ───────────────────────────────

function loadProfile(profile: ApiProfile): void {
  currentProfileName = profile.name;
  originalProfileName = profile.name;
  (document.getElementById('profileName') as HTMLInputElement).value = profile.name;
  rows = profile.envVars.map((ev) => ({ name: ev.name, value: ev.value }));
  renderTable();
  document.getElementById('deleteBtn')!.disabled = false;
  const isActive = profile.name === activeProfileName;
  document.getElementById('activateBtn')!.disabled = isActive;
  document.getElementById('emptyState')!.style.display = 'none';
  document.getElementById('editorContent')!.classList.add('visible');
  rebuildSidebar(profile.name);
  updateBadge();
}

// ── Default template vars ────────────────────────────────

function defaultVars(): EnvVar[] {
  return [
    { name: 'ANTHROPIC_BASE_URL', value: '' },
    { name: 'ANTHROPIC_AUTH_TOKEN', value: '' },
    { name: 'ANTHROPIC_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: '' },
    { name: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: '' },
  ];
}

// ── Rebuild profile list in sidebar ──────────────────────

function rebuildSidebar(keepName: string): void {
  const list = document.getElementById('profileList')!;
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

// ── Update active badge ──────────────────────────────────

function updateBadge(): void {
  const b = document.getElementById('activeBadge')!;
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

// ── Handle init from extension ───────────────────────────

function handleInit(data: InitMessage): void {
  profiles = data.profiles || [];
  activeProfileName = data.activeProfileName;
  updateBadge();

  // Preserve current selection if still valid
  let keepName = currentProfileName;
  if (keepName && profiles.every((p) => p.name !== keepName)) {
    // currently selected profile was deleted
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

// ── Clear the form ───────────────────────────────────────

function clearForm(): void {
  currentProfileName = '';
  originalProfileName = '';
  (document.getElementById('profileName') as HTMLInputElement).value = '';
  rows = defaultVars();
  renderTable();
  document.getElementById('deleteBtn')!.disabled = true;
  document.getElementById('activateBtn')!.disabled = true;
  document.getElementById('emptyState')!.style.display = 'flex';
  document.getElementById('editorContent')!.classList.remove('visible');
  rebuildSidebar('');
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
  document.getElementById('emptyState')!.style.display = 'none';
  document.getElementById('editorContent')!.classList.add('visible');
  document.getElementById('profileName')!.focus();
});

// ── Event: Delete button ─────────────────────────────────

document.getElementById('deleteBtn')!.addEventListener('click', () => {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'delete', profileName: currentProfileName });
});

// ── Event: Env table input changes ───────────────────────

document.getElementById('envBody')!.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const idx = parseInt((el.dataset as DOMStringMap).idx || '');
  if (isNaN(idx) || !rows[idx]) return;
  rows[idx][el.classList.contains('ev-name') ? 'name' : 'value'] = el.value;
});

// ── Event: Env table delete row ──────────────────────────

document.getElementById('envBody')!.addEventListener('click', (e) => {
  const btn = e.target as HTMLElement;
  if (!btn.classList.contains('del')) return;
  const idx = parseInt((btn.dataset as DOMStringMap).idx || '');
  rows.splice(idx, 1);
  renderTable();
});

// ── Event: Add variable row ──────────────────────────────

document.getElementById('addRow')!.addEventListener('click', () => {
  rows.push({ name: '', value: '' });
  renderTable();
});

// ── Event: Parse from bash snippet ───────────────────────

document.getElementById('importBtn')!.addEventListener('click', () => {
  const text = (document.getElementById('importArea') as HTMLTextAreaElement).value;
  if (!text.trim()) return;
  const lines = text.split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const m = trimmed.match(/^(?:export\s+)?(\w+)=(.+)$/);
    if (!m) return;
    const found = rows.findIndex((r) => r.name === m[1]);
    if (found >= 0) {
      rows[found].value = m[2];
    } else {
      rows.push({ name: m[1], value: m[2] });
    }
  });
  (document.getElementById('importArea') as HTMLTextAreaElement).value = '';
  renderTable();
});

// ── Event: Save ──────────────────────────────────────────

document.getElementById('saveBtn')!.addEventListener('click', () => {
  const name = (document.getElementById('profileName') as HTMLInputElement).value.trim();
  if (!name) {
    document.getElementById('profileName')!.focus();
    return;
  }
  vscode.postMessage({
    command: 'save',
    profile: { name, envVars: collect() },
    oldName: originalProfileName,
  });
});

// ── Event: Activate ──────────────────────────────────────

document.getElementById('activateBtn')!.addEventListener('click', () => {
  if (!currentProfileName) return;
  vscode.postMessage({ command: 'activate', profileName: currentProfileName });
});

// ── Start: tell extension we're ready ────────────────────

renderTable();
vscode.postMessage({ command: 'ready' });
