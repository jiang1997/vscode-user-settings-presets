# User Settings Presets

A VS Code: extension to save multiple preset values for any setting key in `settings.json` and switch between them instantly.

[![Latest Release](https://img.shields.io/github/v/release/jiang1997/user-settings-presets?label=download&color=007ACC)](https://github.com/jiang1997/user-settings-presets/releases/latest)

![Screenshot](https://github.com/jiang1997/user-settings-presets/raw/master/screenshot.png)

## Usage

Open via **Command Palette** (`Ctrl+Shift+P` → `User Settings Presets: Manage Presets`) or click the active preset name in the status bar.

### Managing Presets

- **Left sidebar** — lists all saved presets. `●` marks the active one, `○` inactive ones. Click a preset to load it for editing.
- **Preset card** — shows the preset name and whether it's currently active.
- **Setting card** — enter the setting key (e.g., `python.defaultInterpreterPath`) and a JSON value. Strings need quotes; numbers and booleans do not.

## Build

```bash
npm install
npm run compile
npm test          # 9 tests
npm run package   # generates .vsix
```
