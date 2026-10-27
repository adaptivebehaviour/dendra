import { SidecarManager } from '@adaptivebehaviour/desktop/src/sidecar/index';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Same shape as the context the shell's own sidecar.ts declares (this file replaces that one).
export interface SidecarContext {
  log: (line: string) => void;
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  allowedEnv: string[];
}

/**
 * Where the Python backend runs from.
 *  - Development: the sibling `backend/` folder of this project, using `AB_SIDECAR_PYTHON` if set, else the
 *    backend's own `.venv`, else `python` on the PATH.
 *  - Packaged: `python/` and `backend/` next to the app in the resources folder (see the packaging step).
 */
function launchFor(context: SidecarContext) {
  if (context.isPackaged) {
    const python = join(context.resourcesPath, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
    const backend = join(context.resourcesPath, 'backend');
    if (!existsSync(python) || !existsSync(join(backend, 'main.py'))) {
      throw new Error('The Python backend is missing from this installation');
    }
    return { command: python, args: ['main.py'], cwd: backend };
  }
  const backend = join(context.appPath, '..', 'backend');
  const venvPython = join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const command = process.env['AB_SIDECAR_PYTHON'] || (existsSync(venvPython) ? venvPython : 'python');
  return { command, args: ['main.py'], cwd: backend };
}

/** The Python backend of this application: started when the app starts, stopped when it quits. */
export function createSidecar(context: SidecarContext): SidecarManager {
  return new SidecarManager({
    launch: () => launchFor(context),
    allowedEnv: context.allowedEnv,
    log: context.log,
  });
}
