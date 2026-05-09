# Generalize VS Code: Settings Profile Manager

## Overview

Transform the Claude Code:-specific profile manager into a general VS Code: extension that can manage arbitrary settings in `settings.json`. Each profile targets a single setting key (e.g., `python.defaultInterpreterPath`, `claudeCode.environmentVariables`) and stores a raw JSON value.

## Motivation

The current extension is hardcoded to manage only `claudeCode.environmentVariables`. Users have expressed interest in using the same profile-switching pattern for other extensions' settings. Generalizing removes this artificial limitation while keeping the same simple UX.

## Data Model

### Profile

```ts
interface SettingProfile {
  name: string;       // e.g., "Work Python"
  settingKey: string; // e.g., "python.defaultInterpreterPath"
  value: any;         // raw JSON value written to settings.json
}
```

### Removed types

- `EnvVar` — no longer needed
- `ApiProfile` — replaced by `SettingProfile`
- `LegacyApiProfile` — clean break, no migration

## Architecture

### Extension Host (`extension.ts`)

- Remove `initDefaultProfile()` entirely. No first-run import logic.
- Status bar shows generic "Active profile: X" instead of Claude-specific text.
- Single command: open the profile manager webview.

### Profile Manager Panel (`profileManagerPanel.ts`)

- `writeSetting(settingKey: string, value: any, settingsUri: Uri)` — writes to the given key in `settings.json`. Uses `vscode.workspace.getConfiguration().update(settingKey, value, Global)` for remote, direct file write for local.
- `clearSetting(settingKey: string, settingsUri: Uri)` — removes the key from `settings.json`.
- Message handlers (`save`, `activate`, `delete`) operate on `SettingProfile`.

### Webview UI (`media/index.html`, `src/webview/script.ts`)

Replace the "Environment Variables" card with:

- **Setting Key** — text input for the dotted setting path
- **Value** — textarea for raw JSON

Remove:
- Env var table and "Add" button
- "Parse from bash snippet" import block
- `defaultVars()` template

### Package Manifest (`package.json`)

- Update `name`, `displayName`, `description` to be generic.
- Rename command to `settingProfileManager.manageProfiles`.
- Remove `claudeSettingManager.environmentVariableName` configuration.
- Remove `claudeCode.environmentVariables` configuration contribution (we no longer own that schema).

## Data Flow

### Save Profile

1. User fills name, setting key, and JSON value in webview.
2. Webview validates JSON syntax.
3. Webview sends `save` message with `{ name, settingKey, value }`.
4. Extension stores profile in `globalState`.
5. If the saved profile is currently active, extension writes `value` to `settingKey` in `settings.json`.

### Activate Profile

1. User clicks "Activate" in webview.
2. Webview sends `activate` message with `profileName`.
3. Extension looks up the profile, writes `profile.value` to `profile.settingKey` in `settings.json`.
4. Extension stores active profile name in `globalState`.
5. Extension updates status bar.
6. Extension prompts user to reload window.

### Delete Profile

1. User clicks "Delete".
2. Extension confirms via modal.
3. If deleted profile was active, extension clears that setting key from `settings.json`.
4. Extension removes profile from `globalState`.

## Error Handling

- **Invalid JSON value**: Webview validates with `JSON.parse()` before sending. Extension validates again before writing.
- **Invalid setting key**: VS Code:'s `config.update()` will reject malformed keys; catch and show error message.
- **Read/write failure**: Same error handling as today — log to console and throw to surface to user.

## Testing

- Update `profileCrud.test.ts` to create/save/delete `SettingProfile` objects.
- Remove `migration.test.ts` and `importParser.test.ts` (no longer relevant).
- Remove `envFilter.test.ts` if it tests env-var-specific logic.

## Open Questions

None at this time.
