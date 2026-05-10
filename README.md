# VS Code: Settings Profile Manager

A VS Code: extension to manage multiple setting profiles and switch between them without manually editing `settings.json`.

[![Latest Release](https://img.shields.io/github/v/release/jiang1997/vscode-settings-profile-manager?label=download&color=007ACC)](https://github.com/jiang1997/vscode-settings-profile-manager/releases/latest)

![Screenshot](https://github.com/jiang1997/vscode-settings-profile-manager/raw/master/screenshot.png)

## Usage

Open via **Command Palette** (`Ctrl+Shift+P` → `Settings Profile: Manage Profiles`) or click the active profile name in the status bar.

### Managing Profiles

- **Left sidebar** — lists all saved profiles. `●` marks the active one, `○` inactive ones. Click a profile to load it for editing.
- **Profile card** — shows the profile name and whether it's currently active.
- **Setting card** — enter the setting key (e.g., `python.defaultInterpreterPath`) and a JSON value. Strings need quotes; numbers and booleans do not.

## Build

```bash
npm install
npm run compile
npm test          # 9 tests
npm run package   # generates .vsix
```
