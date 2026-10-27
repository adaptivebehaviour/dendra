import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Plain bridge results as the renderer sees them: { ok: true, value } or { ok: false, error: { code, message } }.
type Result = { ok: boolean; value?: unknown; error?: { code: string; message: string } };

// Playwright compiles this file as CommonJS (the shell is not "type": "module", because Electron's sandboxed preload must be CJS).
const appDir = join(__dirname, '..');
const python = process.env.AB_SIDECAR_PYTHON;

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test.describe('electron-fastapi: the Python backend', () => {
  test.skip(!python, 'AB_SIDECAR_PYTHON must point at a Python with the backend installed (scripts/smoke_application.py sets it)');

  test('starts with the app, answers requests through it, and stops with the app', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ab-electron-sidecar-'));
    try {
      const app = await electron.launch({
        args: [appDir, `--user-data-dir=${join(dir, 'userData')}`, ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])],
        cwd: appDir,
        env: { ...process.env, ELECTRON_RENDERER_URL: '', AB_SIDECAR_PYTHON: python! },
      });
      const page = await app.firstWindow();

      // The backend starts with the app; the page shows nothing about it.
      const backendState = () =>
        page.evaluate(async () => {
          const bridge = (window as unknown as { abBridge: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> }).abBridge;
          return ((await bridge.sidecar.status()) as { value?: { state: string } }).value?.state;
        });
      await expect.poll(backendState, { timeout: 30_000 }).toBe('ready');

      const call = (method: string, path: string, body?: unknown) =>
        page.evaluate(async ({ method, path, body }) => {
          const bridge = (window as unknown as { abBridge: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> }).abBridge;
          return (await bridge.sidecar.request({ method, path, body })) as Result;
        }, { method, path, body });

      // The backend defines no routes of its own, so only its built-in health route answers.
      expect((await call('GET', '/health')).ok).toBe(true);

      // The renderer cannot shut the backend down or reach outside it.
      expect((await call('POST', '/shutdown')).error?.code).toBe('invalid_request');
      expect((await call('GET', '/../etc/passwd')).error?.code).toBe('invalid_request');
      expect((await call('GET', '/no-such-route')).error?.code).toBe('service_error');

      const pid = ((await call('GET', '/health')).value as { pid: number }).pid;
      expect(alive(pid)).toBe(true);

      // Quitting the app leaves no Python process behind.
      await app.close();
      await expect.poll(() => alive(pid), { timeout: 10_000 }).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
