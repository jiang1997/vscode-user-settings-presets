# Claude Setting Manager

A VS Code extension to manage multiple Claude Code API profiles and switch between them without manually editing `settings.json`.

## Commands

- **Claude Setting: Add Profile** — register a new profile (name + base URL + API key).
- **Claude Setting: Switch Profile** — pick a saved profile to activate. The extension writes both `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` into `claude-code.environmentVariables` (VS Code user settings). Nothing outside VS Code is modified.

## Settings

| Key | Default | Purpose |
|-----|---------|---------|
| `claudeSettingManager.environmentVariableName` | `ANTHROPIC_BASE_URL` | Environment variable name used for the base URL. The API-key variable is fixed to `ANTHROPIC_API_KEY`. |

## Build

```bash
npm install
npm run compile   # tsc -> out/extension.js
npm run package   # vsce package -> .vsix
```
