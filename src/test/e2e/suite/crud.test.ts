import * as assert from 'assert';
import * as vscode from 'vscode';
import { PRESETS_KEY, APPLIED_PRESET_KEY, SettingPreset } from '../../../types';
import type { PresetManagerPanel } from '../../../presetManagerPanel';
import {
  getExtensionContext,
  openPanel,
  resetState,
  getConfigValue,
  stubReloadPrompt,
  restoreReloadPrompt,
  stubDeleteConfirm,
  restoreDeleteConfirm,
} from './helpers';

describe('CRUD', () => {
  let ctx: vscode.ExtensionContext;
  let panel: PresetManagerPanel;

  before(() => stubReloadPrompt());
  after(() => restoreReloadPrompt());

  beforeEach(async () => {
    ctx = await getExtensionContext();
    await resetState(ctx);
    panel = await openPanel();
  });

  it('new preset is persisted to globalState', async () => {
    const preset: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
    await panel.handleSave({ preset });

    const presets = ctx.globalState.get<SettingPreset[]>(PRESETS_KEY) ?? [];
    assert.deepStrictEqual(presets, [preset]);
  });

  it('save modification updates existing preset by name', async () => {
    const original: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
    await panel.handleSave({ preset: original });

    const modified: SettingPreset = { name: 'p1', settingKey: 'bar', value: 2 };
    await panel.handleSave({ preset: modified });

    const presets = ctx.globalState.get<SettingPreset[]>(PRESETS_KEY) ?? [];
    assert.strictEqual(presets.length, 1);
    assert.strictEqual(presets[0].settingKey, 'bar');
    assert.strictEqual(presets[0].value, 2);
  });

  it("apply writes the preset's value to settings.json", async () => {
    const preset: SettingPreset = { name: 'p1', settingKey: 'foo', value: 42 };
    await panel.handleSave({ preset });

    await panel.handleApply({ presetName: 'p1' });

    assert.strictEqual(await getConfigValue('foo'), 42);
    assert.strictEqual(ctx.globalState.get(APPLIED_PRESET_KEY), 'p1');
  });

  it('delete removes preset from globalState', async () => {
    stubDeleteConfirm();
    try {
      const preset: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
      await panel.handleSave({ preset });

      await panel.handleDelete({ presetName: 'p1' });

      const presets = ctx.globalState.get<SettingPreset[]>(PRESETS_KEY) ?? [];
      assert.strictEqual(presets.length, 0);
    } finally {
      restoreDeleteConfirm();
    }
  });
});
