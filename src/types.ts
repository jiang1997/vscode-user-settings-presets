import * as vscode from 'vscode';

export interface SettingPreset {
  name: string;
  settingKey: string;
  value: unknown;
}

export const PRESETS_KEY = 'settingPresets';
export const SELECTED_PRESET_KEY = 'selectedSettingPreset';

export function loadPresets(context: vscode.ExtensionContext): SettingPreset[] {
  return context.globalState.get(PRESETS_KEY, []);
}
