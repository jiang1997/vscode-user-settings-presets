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
const templateSelect = $('templateSelect') as HTMLSelectElement;

// ── Render helpers ────────────────────────────────────────

function loadProfile(profile: SettingProfile): void {
  currentProfileName = profile.name;
  originalProfileName = profile.name;
  profileNameInput.value = profile.name;
  settingKeyInput.value = profile.settingKey;
  settingValueInput.value = JSON.stringify(profile.value, null, 2);
  templateSelect.value = TEMPLATES[profile.settingKey] ? profile.settingKey : '';
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

interface ProfileTemplate {
  settingKey: string;
  value: any;
}

const TEMPLATES: Record<string, ProfileTemplate> = {
  'claudeCode.environmentVariables': {
    settingKey: 'claudeCode.environmentVariables',
    value: [{ name: '', value: '' }],
  },
  'python.defaultInterpreterPath': {
    settingKey: 'python.defaultInterpreterPath',
    value: '/usr/bin/python3',
  },
  'git.path': {
    settingKey: 'git.path',
    value: '/usr/bin/git',
  },
};

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
  templateSelect.value = '';
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
    return { ok: false, error: `Invalid JSON value: ${e instanceof Error ? e.message : String(e)}` };
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

// ── Event: Template select ───────────────────────────────

document.getElementById('templateSelect')!.addEventListener('change', () => {
  const key = templateSelect.value;
  if (key && TEMPLATES[key]) {
    const t = TEMPLATES[key];
    settingKeyInput.value = t.settingKey;
    settingValueInput.value = JSON.stringify(t.value, null, 2);
  }
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
    const err = document.createElement('div');
    err.textContent = result.error;
    err.style.cssText = 'color:#f48771;margin:8px 0;font-size:12px;';
    const actions = document.querySelector('.actions')!;
    actions.parentNode!.insertBefore(err, actions);
    setTimeout(() => err.remove(), 3000);
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
