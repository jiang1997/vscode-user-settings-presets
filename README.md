# Claude Code Profile Manager

A VS Code extension to manage multiple Claude Code API profiles and switch between them without manually editing `settings.json`.

[![Latest Release](https://img.shields.io/github/v/release/jiang1997/claude-code-profile-manager?label=download&color=007ACC)](https://github.com/jiang1997/claude-code-profile-manager/releases/latest)

![Screenshot](https://github.com/jiang1997/claude-code-profile-manager/raw/master/screenshot.png)

## Usage

Open via **Command Palette** (`Ctrl+Shift+P` → `Claude Code Profile: Manage Profiles`) or click the active profile name in the status bar.

### Managing Profiles

- **Left sidebar** — lists all saved profiles. `●` marks the active one, `○` inactive ones. Click a profile to load its variables for editing.
- **Profile card** — shows the profile name and whether it's currently active.
- **Environment Variables card** — editable table of name/value pairs. Click `+ Add` for a new row, `✕` to remove.
- **Parse from bash snippet** — paste `export VAR=value` lines and click Import to fill the table.

## First Launch

If you already have `claudeCode.environmentVariables` configured in your `settings.json`, the extension automatically imports them as a **Default** profile.

## Build

```bash
npm install
npm run compile
npm test          # 24 tests
npm run package   # generates .vsix
```
