// ── VS Code: API shim ──────────────────────────────────────

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// ── Types ─────────────────────────────────────────────────

interface SettingPreset {
  name: string;
  settingKey: string;
  value: unknown;
}

interface InitMessage {
  command: 'init';
  presets: SettingPreset[];
  activePresetName: string | null;
}

type WebviewMessage = InitMessage;

// ── State ─────────────────────────────────────────────────

const vscode = acquireVsCodeApi();
let presets: SettingPreset[] = [];
let currentPresetName = '';
let originalPresetName = '';

// ── DOM refs ──────────────────────────────────────────────

const $ = (id: string) => document.getElementById(id)!;
const presetNameInput = $('presetName') as HTMLInputElement;
const settingKeyInput = $('settingKey') as HTMLInputElement;
const settingValueInput = $('settingValue') as HTMLTextAreaElement;
const templateSelect = $('templateSelect') as HTMLSelectElement;

// ── Render helpers ────────────────────────────────────────

function loadPreset(preset: SettingPreset): void {
  currentPresetName = preset.name;
  originalPresetName = preset.name;
  presetNameInput.value = preset.name;
  settingKeyInput.value = preset.settingKey;
  settingValueInput.value = JSON.stringify(preset.value, null, 2);
  templateSelect.value = TEMPLATES[preset.settingKey] ? preset.settingKey : '';
  $('deleteBtn')!.disabled = false;
  $('applyBtn')!.disabled = false;
  $('emptyState')!.style.display = 'none';
  $('editorContent')!.classList.add('visible');
  rebuildSidebar(preset.name);
}

function rebuildSidebar(keepName: string): void {
  const list = $('presetList');
  list.textContent = '';
  presets.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'preset-item' + (p.name === keepName ? ' active' : '');
    (div.dataset as DOMStringMap).name = p.name;
    div.textContent = p.name;
    list.appendChild(div);
  });
}

interface PresetTemplate {
  settingKey: string;
  value: unknown;
}

const TEMPLATES: Record<string, PresetTemplate> = {
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

function nextPresetName(): string {
  let max = 0;
  const re = /^preset-(\d+)$/;
  for (const p of presets) {
    const m = p.name.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `preset-${max + 1}`;
}

function clearForm(): void {
  currentPresetName = '';
  originalPresetName = '';
  presetNameInput.value = '';
  settingKeyInput.value = '';
  settingValueInput.value = '';
  templateSelect.value = '';
  $('deleteBtn')!.disabled = true;
  $('applyBtn')!.disabled = true;
  $('emptyState')!.style.display = 'flex';
  $('editorContent')!.classList.remove('visible');
  rebuildSidebar('');
}

function handleInit(data: InitMessage): void {
  presets = data.presets || [];

  let keepName = currentPresetName;
  if (keepName && presets.every((p) => p.name !== keepName)) {
    keepName = presets.length > 0 ? presets[0].name : '';
  }
  rebuildSidebar(keepName);

  if (keepName) {
    const p = presets.find((p) => p.name === keepName);
    if (p) loadPreset(p);
  } else if (presets.length > 0) {
    loadPreset(presets[0]);
  } else {
    clearForm();
  }
}

function validatePreset(): { ok: true; preset: SettingPreset } | { ok: false; error: string } {
  const name = presetNameInput.value.trim();
  if (!name) {
    presetNameInput.focus();
    return { ok: false, error: 'Preset name is required' };
  }

  const settingKey = settingKeyInput.value.trim();
  if (!settingKey) {
    settingKeyInput.focus();
    return { ok: false, error: 'Setting key is required' };
  }

  const valueText = settingValueInput.value.trim();
  let value: unknown;
  try {
    value = valueText ? JSON.parse(valueText) : undefined;
  } catch (e) {
    settingValueInput.focus();
    return { ok: false, error: `Invalid JSON value: ${e instanceof Error ? e.message : String(e)}` };
  }

  return { ok: true, preset: { name, settingKey, value } };
}

// ── Event: messages from extension ───────────────────────

window.addEventListener('message', (e) => {
  const msg = e.data as WebviewMessage;
  if (msg.command === 'init') {
    handleInit(msg);
  }
});

// ── Event: sidebar preset click ─────────────────────────

document.getElementById('presetList')!.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const item = el.closest('.preset-item') as HTMLElement | null;
  if (!item) return;
  const name = (item.dataset as DOMStringMap).name;
  const p = presets.find((p) => p.name === name);
  if (p) loadPreset(p);
});

// ── Event: Template select ───────────────────────────────

document.getElementById('templateSelect')!.addEventListener('change', () => {
  const key = templateSelect.value;
  if (key && TEMPLATES[key]) {
    const t = TEMPLATES[key];
    settingKeyInput.value = t.settingKey;
    settingValueInput.value = JSON.stringify(t.value, null, 2);
  } else {
    settingKeyInput.value = '';
    settingValueInput.value = '';
  }
});

// ── Event: + New Preset button ──────────────────────────

document.getElementById('newBtn')!.addEventListener('click', () => {
  clearForm();
  $('emptyState')!.style.display = 'none';
  $('editorContent')!.classList.add('visible');
  const name = nextPresetName();
  presetNameInput.value = name;
  currentPresetName = name;
  originalPresetName = '';
  presetNameInput.focus();
  presetNameInput.select();
});

// ── Event: Delete button ─────────────────────────────────

document.getElementById('deleteBtn')!.addEventListener('click', () => {
  if (!currentPresetName) return;
  vscode.postMessage({ command: 'delete', presetName: currentPresetName });
});

// ── Event: Save ──────────────────────────────────────────

document.getElementById('saveBtn')!.addEventListener('click', () => {
  const result = validatePreset();
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
    preset: result.preset,
    oldName: originalPresetName,
  });
  currentPresetName = result.preset.name;
  originalPresetName = result.preset.name;
});

// ── Event: Apply ─────────────────────────────────────────

document.getElementById('applyBtn')!.addEventListener('click', () => {
  if (!currentPresetName) return;
  vscode.postMessage({ command: 'apply', presetName: currentPresetName });
});

// ── Start: tell extension we're ready ────────────────────

vscode.postMessage({ command: 'ready' });
