import * as assert from 'assert';
import * as vscode from 'vscode';
import { PRESETS_KEY, SELECTED_PRESET_KEY, SettingPreset } from '../../../types';
import type { PresetManagerPanel } from '../../../presetManagerPanel';
import {
  getExtensionContext,
  openPanel,
  resetState,
  readSettings,
  stubReloadPrompt,
  restoreReloadPrompt,
  stubDeleteConfirm,
  restoreDeleteConfirm,
} from './helpers';

describe('edge cases', () => {
  let ctx: vscode.ExtensionContext;
  let panel: PresetManagerPanel;

  before(() => stubReloadPrompt());
  after(() => restoreReloadPrompt());

  beforeEach(async () => {
    ctx = await getExtensionContext();
    await resetState(ctx);
    panel = await openPanel();
  });

  it('renaming the active preset preserves the active pointer', async () => {
    const original: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
    await panel.handleSave({ preset: original });
    await panel.handleApply({ presetName: 'p1' });

    const renamed: SettingPreset = { name: 'p1-renamed', settingKey: 'foo', value: 1 };
    await panel.handleSave({ preset: renamed, oldName: 'p1' });

    assert.strictEqual(ctx.globalState.get(SELECTED_PRESET_KEY), 'p1-renamed');
    const settings = await readSettings(ctx);
    assert.strictEqual(settings['foo'], 1);
  });

  it('deleting the active preset clears its setting from settings.json', async () => {
    stubDeleteConfirm();
    try {
      const preset: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
      await panel.handleSave({ preset });
      await panel.handleApply({ presetName: 'p1' });

      await panel.handleDelete({ presetName: 'p1' });

      const settings = await readSettings(ctx);
      assert.strictEqual(settings['foo'], undefined);
      assert.strictEqual(ctx.globalState.get(SELECTED_PRESET_KEY), undefined);
    } finally {
      restoreDeleteConfirm();
    }
  });

  it('save with same name twice does not duplicate', async () => {
    const v1: SettingPreset = { name: 'p1', settingKey: 'foo', value: 1 };
    const v2: SettingPreset = { name: 'p1', settingKey: 'foo', value: 2 };
    await panel.handleSave({ preset: v1 });
    await panel.handleSave({ preset: v2 });

    const presets = ctx.globalState.get<SettingPreset[]>(PRESETS_KEY) ?? [];
    assert.strictEqual(presets.length, 1);
    assert.strictEqual(presets[0].value, 2);
  });

  it('switching between two presets with the same setting key updates settings.json', async () => {
    const a: SettingPreset = { name: 'A', settingKey: 'shared', value: 'first' };
    const b: SettingPreset = { name: 'B', settingKey: 'shared', value: 'second' };
    await panel.handleSave({ preset: a });
    await panel.handleSave({ preset: b });

    await panel.handleApply({ presetName: 'A' });
    let settings = await readSettings(ctx);
    assert.strictEqual(settings['shared'], 'first');

    await panel.handleApply({ presetName: 'B' });
    settings = await readSettings(ctx);
    assert.strictEqual(settings['shared'], 'second');
    assert.strictEqual(ctx.globalState.get(SELECTED_PRESET_KEY), 'B');
  });
});
