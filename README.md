# User Settings Presets

A VS Code: extension to save multiple preset values for any setting key in `settings.json` and switch between them instantly.

[![Latest Release](https://img.shields.io/github/v/release/jiang1997/vscode-user-settings-presets?label=download&color=007ACC)](https://github.com/jiang1997/vscode-user-settings-presets/releases/latest)

![Screenshot](https://github.com/jiang1997/vscode-user-settings-presets/raw/master/screenshot.png)

## Usage

Open via **Command Palette** (`Ctrl+Shift+P` → `User Settings Presets: Manage Presets`).

### Managing Presets

- **Left sidebar** — lists all saved presets. Click a preset to load it for editing; the highlighted item is the one currently open in the editor.
- **Preset card** — an editable preset name field.
- **Setting card** — pick a **Template** for common keys (Claude Code env vars, Python interpreter, Git path) to auto-fill, or enter the setting key (e.g., `python.defaultInterpreterPath`) and a JSON value manually. Strings need quotes; numbers and booleans do not.

### Example: Switch Claude Code: Provider

Create two presets with the same setting key `claudeCode.environmentVariables`, then switch between them in one click.

**Preset: `Claude via Kimi`**

```json
[
    {
        "name": "ANTHROPIC_BASE_URL",
        "value": "https://api.kimi.com/coding/"
    },
    {
        "name": "ANTHROPIC_AUTH_TOKEN",
        "value": "your-kimi-api-key"
    }
]
```

**Preset: `Claude via OpenRouter`**

```json
[
    {
        "name": "ANTHROPIC_BASE_URL",
        "value": "https://openrouter.ai/api/v1"
    },
    {
        "name": "ANTHROPIC_AUTH_TOKEN",
        "value": "your-openrouter-api-key"
    }
]
```

Click **Apply** on either preset, then choose **Reload Window** in the notification — Claude Code will use the corresponding provider immediately.

## Build

```bash
npm install
npm run compile
npm run lint      # ESLint (errors fail; existing `any` usages are warnings)
npm run test:unit  # 16 unit tests (fast, no VS Code)
npm run test:e2e   # 8 e2e tests (launches real VS Code via @vscode/test-electron)
npm test           # both
npm run package    # generates .vsix
```
