# Claude Profile Manager

A VS Code extension to manage multiple Claude Code API profiles and switch between them without manually editing `settings.json`.

## Usage

**Command Palette** → `Claude Setting: Manage Profiles` or click the active profile in the status bar.

The management page provides:

- **Profile sidebar** — switch between saved profiles
- **Environment variable editor** — add, edit, or remove variables for each profile
- **Bash import** — paste `export VAR=value` lines to import variables
- **Save** — persist edits without activating
- **Activate** — write the profile's variables to `claudeCode.environmentVariables`
- **Delete** — remove a profile

## Settings

| Key | Default | Purpose |
|-----|---------|---------|
| `claudeSettingManager.environmentVariableName` | `ANTHROPIC_BASE_URL` | (Legacy) No longer used |

## Build

```bash
npm install
npm run compile   # tsc -> out/
npm test          # 14 unit tests
npm run package   # vsce package -> .vsix
```
