@echo off
rem Installs the desktop application's dependencies: double-click this file. Needs Node.js on the PATH, and Python if there is a backend.
rem Run it once after the project is created or moved to a new machine, and again after a manifesto upgrade.
cd /d "%~dp0frontend"
if errorlevel 1 (pause & exit /b 1)
call npm install
if errorlevel 1 (pause & exit /b 1)
rem npm install can leave out Electron's own binary ("Electron uninstall" on start); this fetches it.
call node node_modules/electron/install.js
if errorlevel 1 (pause & exit /b 1)
rem A project with a Python backend (sibling backend folder) gets its own virtual environment, which the app starts the
rem backend with: the backend's dependencies, including the vendored ab_* wheels, are installed into it.
if exist "%~dp0backend\requirements.txt" (
  if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    python -m venv "%~dp0backend\.venv"
    if errorlevel 1 (pause & exit /b 1)
  )
  rem pip resolves the ./vendor/... wheel paths in requirements.txt relative to the current folder, so run it from backend.
  pushd "%~dp0backend"
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 (popd & pause & exit /b 1)
  popd
)
echo.
echo Dependencies installed.
pause
