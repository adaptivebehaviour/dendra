# dendra

Electron desktop application with a local FastAPI backend (the sidecar), scaffolded from manifesto's `electron-fastapi` application. `frontend/` is the Electron app; `backend/` is the Python sidecar. They ship as one installable application.

- Collections are composed in `frontend/src/renderer/registry.ts`; the project's own is `frontend/collection/` (`dendra`).
- The screen has a horizontal toolbar across the top (`frontend/src/renderer/Toolbar.tsx`) with two icon buttons, New (folder-plus icon) and Open (folder-open icon). New creates a workspace and Open opens one (see `.notes/prd-v1.0.0.md`). Icons come from Sanity (`frontend/src/renderer/icons.tsx`).
- The framework is vendored from manifesto release 2.3.0 in each half's `vendor/`. Change manifesto and take a new release; never edit `vendor/`. Upgrade with `update-project`.
- Run: F5 in VS Code, or double-click `dendra.cmd`. Install dependencies first with `install.cmd`. Builds are unsigned.
