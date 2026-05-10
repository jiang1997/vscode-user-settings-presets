import * as assert from 'assert';
import { SettingPreset } from '../types';

// ── Pure-logic extracts from PresetManagerPanel ──────────

function upsertPreset(presets: SettingPreset[], preset: SettingPreset, oldName?: string): SettingPreset[] {
  const idx = oldName
    ? presets.findIndex(p => p.name === oldName)
    : presets.findIndex(p => p.name === preset.name);
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  return presets;
}

function deletePreset(presets: SettingPreset[], name: string): SettingPreset[] {
  const idx = presets.findIndex(p => p.name === name);
  if (idx >= 0) presets.splice(idx, 1);
  return presets;
}

function resolveActiveAfterDelete(presets: SettingPreset[], activeName: string | undefined, deletedName: string): string | undefined {
  if (activeName === deletedName) return undefined;
  return activeName;
}

// ── Tests ─────────────────────────────────────────────────

const samplePreset: SettingPreset = {
  name: 'prod',
  settingKey: 'claudeCode.environmentVariables',
  value: [{ name: 'ANTHROPIC_BASE_URL', value: 'https://api.example.com' }],
};

describe('Preset CRUD', () => {
  describe('upsertPreset', () => {
    it('adds a new preset', () => {
      const presets: SettingPreset[] = [];
      const result = upsertPreset(presets, samplePreset);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'prod');
      assert.strictEqual(result[0].settingKey, 'claudeCode.environmentVariables');
    });

    it('updates an existing preset by name', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const updated: SettingPreset = { name: 'prod', settingKey: 'python.defaultInterpreterPath', value: '/usr/bin/python3' };
      const result = upsertPreset(presets, updated);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].settingKey, 'python.defaultInterpreterPath');
      assert.strictEqual(result[0].value, '/usr/bin/python3');
    });

    it('updates by oldName when preset is renamed', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const renamed: SettingPreset = { name: 'production', settingKey: samplePreset.settingKey, value: samplePreset.value };
      const result = upsertPreset(presets, renamed, 'prod');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'production');
    });

    it('does not duplicate when oldName matches an existing preset', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const result = upsertPreset(presets, samplePreset, 'prod');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('deletePreset', () => {
    it('removes a preset by name', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const result = deletePreset(presets, 'prod');
      assert.strictEqual(result.length, 0);
    });

    it('does nothing when name not found', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const result = deletePreset(presets, 'nonexistent');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('resolveActiveAfterDelete', () => {
    it('clears active when deleted preset was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'prod', 'prod'), undefined);
    });

    it('keeps active when another preset was deleted', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'staging', 'prod'), 'staging');
    });

    it('keeps undefined when nothing was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], undefined, 'prod'), undefined);
    });
  });
});
