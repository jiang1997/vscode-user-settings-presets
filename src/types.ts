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
