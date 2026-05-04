import * as vscode from 'vscode';

export interface EnvVar {
  name: string;
  value: string;
}

export interface ApiProfile {
  name: string;
  envVars: EnvVar[];
}

/** Pre-webview profile format — auto-migrated on first load. */
export interface LegacyApiProfile {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export const PROFILES_KEY = 'claudeApiProfiles';
export const SELECTED_PROFILE_KEY = 'selectedClaudeApiProfile';

/** Load profiles from globalState, migrating any legacy-format entries. */
export function loadProfiles(context: vscode.ExtensionContext): ApiProfile[] {
  const raw: any[] = context.globalState.get(PROFILES_KEY, []);
  const migrated: ApiProfile[] = [];
  let changed = false;

  for (const entry of raw) {
    if (Array.isArray((entry as ApiProfile).envVars)) {
      migrated.push(entry as ApiProfile);
    } else {
      const legacy = entry as LegacyApiProfile;
      const envVars: EnvVar[] = [];
      if (legacy.baseUrl) {
        envVars.push({ name: 'ANTHROPIC_BASE_URL', value: legacy.baseUrl });
      }
      if (legacy.apiKey) {
        envVars.push({ name: 'ANTHROPIC_AUTH_TOKEN', value: legacy.apiKey });
      }
      migrated.push({ name: legacy.name, envVars });
      changed = true;
    }
  }

  if (changed) {
    context.globalState.update(PROFILES_KEY, migrated);
  }

  return migrated;
}
