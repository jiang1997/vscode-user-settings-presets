import { SettingPreset } from '../types';

export function upsertPreset(
  presets: readonly SettingPreset[],
  preset: SettingPreset,
  oldName?: string,
): SettingPreset[] {
  const result = [...presets];
  const idx = oldName
    ? result.findIndex(p => p.name === oldName)
    : result.findIndex(p => p.name === preset.name);
  if (idx >= 0) {
    result[idx] = preset;
  } else {
    result.push(preset);
  }
  return result;
}

export function deletePreset(
  presets: readonly SettingPreset[],
  name: string,
): SettingPreset[] {
  const idx = presets.findIndex(p => p.name === name);
  if (idx < 0) return [...presets];
  const result = [...presets];
  result.splice(idx, 1);
  return result;
}

export function resolveActiveAfterDelete(
  activeName: string | undefined,
  deletedName: string,
): string | undefined {
  return activeName === deletedName ? undefined : activeName;
}
