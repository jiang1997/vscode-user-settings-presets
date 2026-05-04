# Claude Profiles Tree View — Design Spec

## Overview

Replace the current command-palette-only profile management with a dedicated **Claude Profiles** sidebar panel. Users can see all saved profiles at a glance and activate, edit, or delete them with a click or right-click.

## Architecture

- **`ProfileTreeProvider`** — `vscode.TreeDataProvider<ProfileTreeItem>` in a new file `src/profileTreeProvider.ts`. Reads profiles from `globalState` and renders them as tree items. Exposes a `refresh()` method called after every mutation.
- **`ProfileTreeItem`** — extends `vscode.TreeItem` with an `ApiProfile` payload. Shows profile name as label, base URL as description, and an icon indicating active/inactive state.
- **Status bar item** — shown only when a profile is active. Reads `$(account) <name>`. Clicking activates the panel.

### Files
- **Create** `src/profileTreeProvider.ts`
- **Modify** `src/extension.ts` — register tree view, status bar item, and new commands
- **Modify** `package.json` — declare view container, view, menus, and new commands

### Storage — no changes
Profiles remain in `context.globalState`. The active profile is still written to `claude-code.environmentVariables` in user settings.

## Commands

| Command | Trigger | Behavior |
|---------|---------|----------|
| `claudeSettingManager.addProfile` | Toolbar "+" button | Opens 3 input boxes (name, URL, key). Saves to `globalState`. Refreshes tree. |
| `claudeSettingManager.editProfile` | Right-click "Edit" | Opens 3 input boxes pre-filled with current values. Updates `globalState`. Refreshes tree. |
| `claudeSettingManager.deleteProfile` | Right-click "Delete" | Confirmation dialog. Removes from `globalState`. If active, clears environment variables. Refreshes tree. |
| `claudeSettingManager.activateProfile` | Click on profile row | Writes URL/key to `claude-code.environmentVariables`. Updates status bar. Refreshes tree (checkmark). |

## UI

- **Panel**: Activity bar "Claude Profiles" view container with a tree view showing all profiles
- **Items**: Active profile gets a checkmark icon and sorts to the top. Empty state shows "No profiles" placeholder.
- **Status bar**: `$(account) <active-profile-name>` — visible only when a profile is active
- **Context menu**: Edit / Delete on profile right-click
- **Toolbar**: Add button in the view title area

## Error Handling

- Cancelled input box aborts the entire operation (no partial updates)
- Deleting the active profile clears `environmentVariables` and the status bar item
- Empty profile list shows a placeholder message

## package.json Contributions

- `viewsContainers.activitybar` — "Claude Profiles" icon in the activity bar
- `views` — tree view inside the container
- `menus.view/item/context` — Edit/Delete on tree items
- `menus.view/title` — Add button in the panel toolbar
