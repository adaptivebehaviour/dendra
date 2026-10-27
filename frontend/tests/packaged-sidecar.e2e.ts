import { chromium, expect, test } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The packaged app with its bundled Python: it starts the backend from resources/python, answers a request, and
// leaves no Python process behind when it quits.
// Needs: `python scripts/bundle_python.py` in ../backend, then `npm run package`. Attached over the DevTools protocol
// (Playwright's _electron API needs the Node inspector switch that hardened builds disable).
const exe = process.env.AB_PACKAGED_EXE || (process.platform === 'win32' ? join(__dirname, '..', 'dist', 'win-unpacked', 'Manifesto.exe') : '');
const bundled = exe ? join(exe, '..', 'resources', 'python') : '';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function stop(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else child.kill('SIGKILL');
}

test.describe('packaged app with the bundled Python backend', () => {
  test.skip(!exe || !existsSync(exe) || !existsSync(bundled), 'no packaged app with a bundled Python: run bundle_python.py, then `npm run package`');

  test('runs the backend from resources/python, and leaves no process behind', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ab-packaged-sidecar-'));
    const userData = join(dir, 'userData');

    const port = await freePort();
    // Deliberately not given AB_SIDECAR_PYTHON: the packaged app must find its own interpreter in resources/python.
    const { AB_SIDECAR_PYTHON: _ignored, ...env } = process.env;
    const child = spawn(exe, [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env });
    let pythonPid: number | undefined;
    try {
      let browser;
      for (let attempt = 0; attempt < 60 && !browser; attempt += 1) {
        try {
          browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      expect(browser, 'could not attach to the packaged app').toBeTruthy();
      const context = browser!.contexts()[0];
      const page = context.pages()[0] ?? (await context.waitForEvent('page'));

      const backendState = () =>
        page.evaluate(async () => {
          const bridge = (window as unknown as { abBridge: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> }).abBridge;
          return ((await bridge.sidecar.status()) as { value?: { state: string } }).value?.state;
        });
      await expect.poll(backendState, { timeout: 30_000 }).toBe('ready');

      const call = (method: string, path: string) =>
        page.evaluate(async ({ method, path }) => {
          const bridge = (window as unknown as { abBridge: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> }).abBridge;
          return (await bridge.sidecar.request({ method, path })) as { ok: boolean; value?: unknown; error?: { code: string } };
        }, { method, path });

      const health = await call('GET', '/health');
      pythonPid = (health.value as { pid: number }).pid;
      expect(alive(pythonPid)).toBe(true);

      // Close the window the way a user would. The app must quit on its own and take its Python process with it:
      // nothing here kills the process tree before the check below.
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      await page.close();
      await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('the app did not quit after its window closed')), 20_000))]);
      await expect.poll(() => alive(pythonPid!), { timeout: 15_000, message: 'a Python process was left behind' }).toBe(false);
    } finally {
      stop(child);
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
    }
  });
});
