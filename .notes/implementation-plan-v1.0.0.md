# dendra Implementation Plan

**PRD**: `prd-v1.0.0.md` (version 1.0.0)

Starting point: the scaffolded application has a toolbar with New and Open buttons that do nothing, and an empty area below it. The steps below are in build order; each lists the PRD requirements it satisfies.

The application's one data destination is the local application folder (PRD section 4). The manifesto 2.3.0 shell is already configured this way by default (`destination` in `frontend/src/main/config.ts`), so no step below builds it.

## 1. Main-process capabilities the renderer needs

The sandboxed renderer cannot touch the file system, so the main process must offer the following. The vendored `desktop` collection's IPC contract has no file-system channels and `vendor/` is never edited, so these are provided within dendra itself, following the `terrane` project:

- The preload script exposes a second bridge alongside `abBridge`, with one named function per operation, each invoking its own IPC channel.
- The main process registers a handler for each channel. Each handler checks that the sender is the application's own page and validates its arguments before acting.
- The folder picker is Electron's open dialog, file operations use Node's file system module in the main process, and files and folders are opened with Electron's shell.

The operations:

- Show a folder picker and return the chosen path (or nothing if cancelled).
- Check whether a folder exists at a location, and create a folder.
- Read and write `dendra.json`.
- Check whether a folder contains `dendra.json`.
- Copy files and folders from one step folder to another.
- List the files and folders in a step folder.
- Open a file in the application the system associates with it.
- Open a folder in a system file window.
- Store and retrieve the last workspace opened, in the local application folder.

Every capability keeps the security requirements in PRD section 8 (sandboxed renderer, context isolation, no network).

## 2. Folder-name validation

A single validator for workspace names and step names. When a name is invalid, the user is asked for an alternative.

Satisfies: F10.

## 3. Step numbering and tree logic

Pure logic with no UI, covering PRD 5.2 and 5.3:

- The `dendra.json` shape: a `tree` whose entries store the step number, step name, whether the step is branching or sequential, and any further properties needed to define the structure.
- Sequential step number outside a branch: preceding number plus 1.
- Sequential step number within a branch: increment the number after the furthest dot to the right.
- Branching step number: preceding number, then the next lower-case letter (`a` to `z`, then `aa`, `ab`, and so on), then `.0`.
- A step has a follower only when a sequential step follows it; a branching step is not a follower.
- Branch side: the first branching step from a step goes left or right at random; later ones alternate evenly, each placed beyond the furthermost branching step on that side.
- Step folder name: step number, underscore, step name.
- Which of the right-click options are valid for a given step (PRD 6.4 table).

Satisfies: F9, F13 (rules).

## 4. Create a workspace

1. **New** prompts for a workspace name; the name is validated (step 2).
2. A folder picker chooses the location.
3. The workspace folder is created; if the name already exists there, a copy-number suffix is added (e.g. `-1`).
4. `dendra.json` is written with the `start` step, number 0, and the folder `0_start` is created.
5. The new workspace becomes the open workspace.

Cancelling the name prompt or the folder picker changes nothing.

Satisfies: F1, F2, F3, F10, F14.

## 5. Open a workspace and startup behaviour

1. **Open** shows a folder picker.
2. A folder without `dendra.json` is rejected.
3. Cancelling changes nothing.
4. The opened workspace is recorded as the last workspace.
5. On startup, the last workspace is reopened; with none, only the toolbar is shown.

Satisfies: F4, F5, F14.

## 6. Step display

Render the open workspace's tree below the toolbar (PRD 6.3):

- Landscape rectangles, 100px wide; minimum height of one line of text plus padding, maximum of two lines plus the same padding.
- Each rectangle shows the step number followed by the name, truncated with an ellipsis when too long.
- The `start` step is at the top, centered horizontally.
- Sequential steps are below their preceding step, joined by a short vertical line.
- Branching steps are to the left or right of their preceding step, joined by a horizontal line; the step following a branching step is below it.

Satisfies: F6.

## 7. Step interactions

On each step rectangle (PRD 6.4):

- Single click: popup listing the step folder's files and folders; clicking a file opens it in its associated application; clicking a folder opens it in a system file window.
- Double click: open the step folder in a system file window.
- Right-click: popup offering only the option valid for that step (step 3), or no popup for a branching step that already has a follower.

Satisfies: F11, F12, F13.

## 8. Create sequential step dialog

1. Right-click a step and choose the sequential option.
2. The dialog asks for a name (validated, step 2) and for the files and folders to copy from the preceding step.
3. On completion, the step is added to the tree following the clicked step, its folder is created, the selected files and folders are copied into it, and `dendra.json` is updated.

Cancelling changes nothing.

Satisfies: F7, F9, F10, F14.

## 9. Create branching step dialog

1. Right-click a step and choose the branching option.
2. The dialog asks for a name (validated, step 2).
3. On completion, the branching step is added to the tree with its number and side (step 3), its folder is created, and `dendra.json` is updated.

Cancelling changes nothing.

Satisfies: F8, F9, F10, F14.

## 10. Wire the toolbar

Link **New** to step 4 and **Open** to step 5.

Satisfies: F1, F4.

## 11. Check against the PRD

Go through F1 to F14 and the non-functional requirements in PRD section 8 (window size limits, no network requests, security settings) and confirm each is met. Also confirm the data destination is still the local application folder (PRD section 4).
