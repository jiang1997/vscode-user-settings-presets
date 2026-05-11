import * as assert from 'assert';
import { SettingPreset } from '../../types';
import { upsertPreset, deletePreset, resolveActiveAfterDelete, findPreset, resolveActiveAfterSave } from '../../lib/presetOps';

const samplePreset: SettingPreset = {
  name: 'prod',
  settingKey: 'claudeCode.environmentVariables',
  value: [{ name: 'ANTHROPIC_BASE_URL', value: 'https://api.example.com' }],
};

describe('presetOps', () => {
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

    it('does not mutate the input array', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const snapshot = JSON.parse(JSON.stringify(presets));
      upsertPreset(presets, { name: 'newer', settingKey: 'k', value: 1 });
      assert.deepStrictEqual(presets, snapshot);
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

    it('does not mutate the input array', () => {
      const presets = [JSON.parse(JSON.stringify(samplePreset))];
      const snapshot = JSON.parse(JSON.stringify(presets));
      deletePreset(presets, 'prod');
      assert.deepStrictEqual(presets, snapshot);
    });
  });

  describe('resolveActiveAfterDelete', () => {
    it('clears active when deleted preset was active', () => {
      assert.strictEqual(resolveActiveAfterDelete('prod', 'prod'), undefined);
    });

    it('keeps active when another preset was deleted', () => {
      assert.strictEqual(resolveActiveAfterDelete('staging', 'prod'), 'staging');
    });

    it('keeps undefined when nothing was active', () => {
      assert.strictEqual(resolveActiveAfterDelete(undefined, 'prod'), undefined);
    });
  });

  describe('findPreset', () => {
    it('returns the preset when found by name', () => {
      const presets = [samplePreset];
      const result = findPreset(presets, 'prod');
      assert.strictEqual(result?.name, 'prod');
    });

    it('returns undefined when name not found', () => {
      const result = findPreset([samplePreset], 'nonexistent');
      assert.strictEqual(result, undefined);
    });
  });

  describe('resolveActiveAfterSave', () => {
    it('returns newName when the active preset is being renamed', () => {
      assert.strictEqual(resolveActiveAfterSave('prod', 'prod', 'production'), 'production');
    });

    it('returns newName when overwriting the currently-active preset with the same name', () => {
      assert.strictEqual(resolveActiveAfterSave('prod', undefined, 'prod'), 'prod');
    });

    it('returns activeName when saving an unrelated preset', () => {
      assert.strictEqual(resolveActiveAfterSave('prod', undefined, 'staging'), 'prod');
    });
  });
});
