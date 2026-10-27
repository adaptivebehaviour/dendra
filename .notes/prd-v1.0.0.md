# dendra Product Requirements Document

**Version**: 1.0.0
**Last updated:** 28/10/26 09:50 AEDT

## 1. Purpose
An application that helps researchers manage analyses by structuring the process as a series of sequential steps.

## 2. Target Users

- Researchers.
- Students.
- Academics.

## 3. Core Concepts

| Concept | Definition |
| ------- | ---------- |
| Step | A collection of files that all relate to a single task. Every step has a number, a name and a step folder (see 5.3). |
| Step number | A number indicating the position of the step in the process. It is calculated automatically (see 5.3). |
| Step name | A name that reflects the task completed in the step. |
| Step folder | The folder holding a step's files, named as the step number, an underscore, then the step name (e.g. `0_start`). |
| Preceding step | The step that a step follows on from: the step the user right-clicked to create it (see 6.4). |
| Sequential step | A step that follows on directly from its preceding step. It is located below it (see 6.5). |
| Branching step | A step created by selecting the option to create a branching step (see 6.6). It is located to the right or left of its preceding step, and its number ends in a letter followed by `.0` (e.g. `4a.0`; see 5.3). |
| Workspace | A folder containing all the files that make up one analysis: a `dendra.json` file and the step folders (see 5). |
| `dendra.json` | The file in the root of a workspace that holds the tree (see 5.2). |
| Tree | The "tree" property of `dendra.json`, which defines the structure of the steps in the workspace. |

## 4. Platform and Stack

**Foundation: the manifesto project type**
- Desktop application built with Electron and a React renderer, with a local Python backend.
- A manifesto project of the `electron-fastapi` application type: an Electron app (`frontend/`) and a FastAPI Python backend (the sidecar, `backend/`) that ship as one installable application. The backend has no routes of its own yet. It lives and dies with the application. Any external service is reached only through declared, allow-listed services in the Electron main process; none are declared.
- The application's one data destination is the local application folder: data sent from the renderer reaches it only through the Electron main process, which stores it in a `data.json` file in the application's data folder (the folder that uninstalling never touches, see 11). Nothing is sent over the network.
- Scaffolded from manifesto release 2.3.0. The framework is vendored in `vendor/` in each half and is never edited there: changes are made in manifesto, a new release is taken, and the project is upgraded with `update-project`.

**Collections**

Composed in load order in `frontend/src/renderer/registry.ts`.

| Collection | Package | Provides | Included |
| ---------- | ------- | -------- | -------- |
| `manifesto` | `@adaptivebehaviour/manifesto` | The base collection: the core object model and the default `root` and `component` factories. | Always |
| `scenes` | `@adaptivebehaviour/scenes-records` | Scene records and the scenes library (with `@adaptivebehaviour/scenes`) for building scene-based, game-like interfaces. | Yes |
| `desktop` | `@adaptivebehaviour/desktop` | Desktop support: the IPC contract, allow-listed network services, main-process helpers and the sidecar manager. | Yes |
| `ui` | `@adaptivebehaviour/ui` | The shared UI components, styled with Tailwind CSS. | Yes |
| `dendra` | `dendra-collection` (in the project's `frontend/collection/` folder) | The product's own components and records. It registers no records yet. | Always, last in load order |

- The research `data` collection is not included.

## 5. Workspace

### 5.1 Creating a workspace
1. The user clicks **New** on the toolbar (see 6.1).
2. The user is prompted for a workspace name. The name is validated as a folder name, and if it is not valid the user is asked to provide an alternative.
3. The user is then shown a folder picker and chooses a local location for the workspace.
4. The application creates a workspace folder with that name in the chosen location. If a folder with that name already exists there, the workspace name is amended with a suffix indicating the number of copies (e.g. `-1`).
5. The workspace folder contains a `dendra.json` file and an initial step with the number 0 and the name "start" (folder `0_start`).

If the user cancels the name prompt or the folder picker, no changes are made.

### 5.2 `dendra.json`
`dendra.json` contains an object with the following property:

| Property | Description |
| -------- | ----------- |
| `tree` | Defines the structure of the steps in the workspace. The `start` step is the first entry in the tree. |

Each entry in the tree has properties that store:
- the step number,
- the step name,
- whether the step is branching or sequential, and
- any further properties required to accurately define the structure of the tree.

### 5.3 Steps
- Every step has a number, a name and a step folder.
- The step number indicates the position of the step in the process.
- The step name reflects the task completed in the step.
- The step folder is named as the step number followed by an underscore followed by the step name (e.g. `4a.0_name`).
- Step names are validated as folder names, and if a name is not valid the user is asked to provide an alternative. Duplicate step names are allowed, because step numbers are always different.
- The initial step has the number 0 and the name "start".
- Users manage the analysis by creating steps, each following on from a preceding step (see 6.4 to 6.6).

**Sequential step numbers**
- The number of a sequential step that follows a step outside a branch is the number of its preceding step plus 1 (e.g. step 4 is followed by step 5).
- The number of a sequential step within a branch is the preceding step's number with the number after the furthest dot to the right incremented (e.g. `4b.0` is followed by `4b.1`, and `4b.3` by `4b.4`).

**Branching step numbers**
- The number of a branching step is the number of the step it branches off (the step the user right-clicked), followed by a lower-case letter of the alphabet, followed by `.0`.
- Each branching step created from the same step is given the next letter of the alphabet.
- Example: from step 4, the first branching step is `4a.0` and the second is `4b.0`. If three sequential steps are then created under `4b.0` and the user creates a branching step off `4b.2`, its number is `4b.2a.0`.
- After the letter z, the letters continue as aa, ab and so on.

**Branching rules**
- A step has a follower only when a sequential step follows it. A branching step is not a follower.
- A branching step cannot be created by clicking on a branching step. Right-clicking a branching step offers only the option to create a sequential step (see 6.4).
- The step following a branching step is located below it.
- The first branching step created from a step goes to the right or the left, selected at random. Subsequent branching steps from that step alternate evenly between the two sides.
- Each additional branching step is located to the right or left of the furthermost branching step on that side.

### 5.4 Opening a workspace
- **Open** on the toolbar shows a folder picker, so the user can select a different workspace.
- If the user cancels the folder picker, no changes are made.
- If the selected folder has no `dendra.json`, it is rejected.

### 5.5 Startup behaviour
- The last workspace opened is reopened when the application starts. Which workspace that is, is stored in the local application folder (see 4).
- If there is no last workspace, the user sees nothing but the toolbar.

## 6. User Interface

### 6.1 Toolbar
A horizontal toolbar across the top of the screen. Below it is the step display (see 6.3) when a workspace is open, and otherwise nothing (no title, text or sample data). It holds two icon-only buttons, each labelled for assistive technology and with a tooltip:
- **New** (folder-plus icon) — starts creating a workspace (see 5.1).
- **Open** (folder-open icon) — shows a folder picker to select a different workspace (see 5.4).

Icons come from Sanity.

### 6.2 New workspace
1. The user clicks **New**.
2. The user is prompted for a workspace name.
3. The user is shown a folder picker and chooses where the workspace is to be created.
4. The workspace is created (see 5.1).

Cancelling at any point makes no changes.

### 6.3 Step display
Steps are represented on the screen as landscape-oriented rectangles embedded in a vertical tree structure.

- The initial step is located at the top of the screen, under the toolbar, and is centered horizontally.
- Each step rectangle displays the step number followed by the name. A name too long for the rectangle is truncated with an ellipsis.
- Step rectangles have a fixed width of 100px. The minimum height allows for one line of text with some padding, and the maximum height allows for two lines of text with the same padding.
- A series of steps is indicated by a short vertical line linking the step rectangles.
- A branching step is located to the right or the left of its preceding step, and is indicated by a horizontal line linking it to the preceding step.
- The step following a branching step is located below it.
- Additional branching steps are located to the right or left of the furthermost branching step on that side. For example, with step 4 and a first branching step `4a.0`, a second branching step gives:

```
4b.0 --- 4 --- 4a.0
```

  and a third gives:

```
4b.0 --- 4 --- 4a.0 --- 4c.0
```

### 6.4 Step interactions
- **Single click** on a step opens a popup listing all the files and folders in the step folder. Clicking a file opens it in the application the system associates with that file type. Clicking a folder opens it in a system window used to navigate the local file system (e.g. Windows Explorer).
- **Double click** on a step opens the step folder in a system window used to navigate the local file system (e.g. Windows Explorer).
- **Right-click** on a step opens a popup, depending on the step clicked:

| Step clicked | Popup |
| ------------ | ----- |
| A step with no follower | The option to create a sequential step only. |
| A step that already has a follower | The option to create a branching step only. |
| A branching step with no follower | The option to create a sequential step only. |
| A branching step that already has a follower | No popup. |

A branching step is not a follower (see 5.3).

Selecting an option leads to the respective dialog (see 6.5 and 6.6).

### 6.5 Create sequential step dialog
1. The user right-clicks an existing step and selects the option to create a sequential step.
2. A dialog asks the user to enter a name for the step and to select files and folders to copy over from the preceding step. The name is validated as a folder name.
3. When the dialog is completed, the step is created following the step that was clicked on, and the selected files and folders are copied (duplicated) from the preceding step to the new step.

Cancelling the dialog makes no changes.

### 6.6 Create branching step dialog
1. The user right-clicks an existing step and selects the option to create a branching step.
2. A dialog asks the user to enter a name for the step. The name is validated as a folder name.
3. When the dialog is completed, the branching step is created (see 5.3).

Cancelling the dialog makes no changes.

## 7. Functional Requirements

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| F1 | User creates a workspace by entering a name and choosing a location (see 5.1) | Must |
| F2 | A new workspace contains a `dendra.json` file and an initial step `0_start` (see 5.1, 5.2) | Must |
| F3 | A workspace name that already exists in the chosen location is amended with a copy-number suffix (see 5.1) | Must |
| F4 | User opens a different workspace using a folder picker; a folder with no `dendra.json` is rejected (see 5.4) | Must |
| F5 | The last workspace opened is reopened on startup (see 5.5) | Must |
| F6 | Steps are displayed as rectangles in a vertical tree (see 6.3) | Must |
| F7 | User creates a sequential step, naming it and selecting files and folders to copy from the preceding step (see 6.5) | Must |
| F8 | User creates a branching step, naming it (see 6.6) | Must |
| F9 | Step numbers are calculated automatically (see 5.3) | Must |
| F10 | Workspace and step names are validated as folder names, and the user is asked for an alternative if one is not valid (see 5.1, 5.3) | Must |
| F11 | Single-clicking a step lists the contents of its step folder, and files and folders can be opened from the list (see 6.4) | Must |
| F12 | Double-clicking a step opens its step folder in a system file window (see 6.4) | Must |
| F13 | Right-clicking a step offers only the options valid for that step (see 6.4) | Must |
| F14 | Cancelling a prompt or dialog makes no changes (see 5.1, 5.4, 6.5, 6.6) | Must |

## 8. Non-Functional Requirements

- **Responsiveness:** The window opens at 1100 × 760 px and cannot be resized below 640 × 480 px.
- **Security and privacy:** The application makes no network requests: the network allow-list is empty and a Content Security Policy blocks all remote origins. Links to external sites do nothing. The renderer is sandboxed, with context isolation on and Node integration off; all permission requests are denied; navigation away from the application and web views are blocked. In a build, the renderer is served from a custom `app://` protocol.

## 9. User Flow

1. The user opens the application and either sees the last workspace opened or, if there is none, only the toolbar (see 5.5).
2. If necessary, the user creates a new workspace (see 5.1) or opens a different one (see 5.4).
3. The user completes an analysis by creating steps, each following on from a preceding step (see 6.5 and 6.6).
4. The user populates the step folders with files relevant to the analysis. This work is done outside the application; the user reaches a step's files by single-clicking or double-clicking the step (see 6.4).

## 10. Success Metrics
*To be determined by the developer.*

## 11. Assumptions and Constraints

- Scope: Desktop only (Windows is the packaged target).
- License: MIT (see `LICENSE` in the project root).
- Instances: Only one instance of the application can run at a time; launching a second focuses the existing window.
- Distribution: The application can be obtained in two ways:
  - **From source:** Install dependencies with `install.cmd`, then run with F5 in VS Code or by double-clicking `dendra.cmd`.
  - **Installer:** Windows NSIS installer, per-user (no administrator rights needed) with a changeable install directory. Builds are unsigned and there is no auto-update feed. Uninstalling never touches the application's data folder. The Python backend is bundled with the installer.

## 12. Decisions
*To be completed.*

## 13. Risks and Open Questions
*To be completed.*
