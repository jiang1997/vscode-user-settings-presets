import * as vscode from 'vscode';

export interface SettingProfile {
  name: string;
  settingKey: string;
  value: any;
}

export const PROFILES_KEY = 'settingProfiles';
export const SELECTED_PROFILE_KEY = 'selectedSettingProfile';

export function loadProfiles(context: vscode.ExtensionContext): SettingProfile[] {
  return context.globalState.get(PROFILES_KEY, []);
}
