import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Playwright compiles this file as CommonJS (the shell is not "type": "module", because Electron's sandboxed preload must be CJS).
const appDir = join(__dirname, '..');

interface Launched {
  app: ElectronApplication;
  page: Page;
  requests: string[];
}

/** Starts the built app with its own user-data folder. */
async function launch(userData: string): Promise<Launched> {
  const app = await electron.launch({
    // GitHub's Linux runners restrict unprivileged user namespaces, which Chromium's own process sandbox needs.
    args: [appDir, `--user-data-dir=${userData}`, ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])],
    cwd: appDir,
    env: { ...process.env, ELECTRON_RENDERER_URL: '' },
  });
  const page = await app.firstWindow();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.waitForLoadState('domcontentloaded');
  return { app, page, requests };
}

async function withTemp<T>(body: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'ab-electron-e2e-'));
  try {
    return await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test.describe('electron shell: starter screen', () => {
  test('shows only a toolbar with a New and an Open button, each holding an icon and no text', async () => {
    await withTemp(async (dir) => {
      const { app, page } = await launch(join(dir, 'userData'));
      await expect(page.getByTestId('app')).toBeAttached();
      const toolbar = page.getByRole('toolbar');
      await expect(toolbar).toBeVisible();
      expect((await toolbar.boundingBox())!.y).toBe(0);
      await expect(toolbar.getByRole('button')).toHaveCount(2);
      await expect(toolbar.getByRole('button', { name: 'New' }).locator('svg')).toHaveCount(1);
      await expect(toolbar.getByRole('button', { name: 'Open' }).locator('svg')).toHaveCount(1);
      expect((await page.locator('body').innerText()).trim()).toBe('');
      await expect(page.locator('input, h1, a')).toHaveCount(0);
      await app.close();
    });
  });

  test('the app makes no network request: everything it loads comes from the app itself', async () => {
    await withTemp(async (dir) => {
      const { app, page, requests } = await launch(join(dir, 'userData'));
      await expect(page.getByTestId('app')).toBeAttached();
      expect(requests.length).toBeGreaterThan(0);
      for (const url of requests) expect(url, url).toMatch(/^(app|data|blob):/);
      await app.close();
    });
  });
});

test.describe('electron shell: security', () => {
  test('the renderer has no Node, no Electron and only the declared bridge', async () => {
    await withTemp(async (dir) => {
      const { app, page } = await launch(join(dir, 'userData'));
      const exposed = await page.evaluate(() => ({
        require: typeof (globalThis as Record<string, unknown>).require,
        process: typeof (globalThis as Record<string, unknown>).process,
        buffer: typeof (globalThis as Record<string, unknown>).Buffer,
        electron: typeof (globalThis as Record<string, unknown>).electron,
        groups: Object.keys((window as unknown as { abBridge: object }).abBridge).sort(),
        isolated: (window as unknown as { abBridge: { app: Record<string, unknown> } }).abBridge.app.info !== undefined,
        protocol: location.protocol,
      }));
      expect(exposed).toMatchObject({ require: 'undefined', process: 'undefined', buffer: 'undefined', electron: 'undefined', isolated: true, protocol: 'app:' });
      expect(exposed.groups).toEqual(['app', 'credentials', 'data', 'net', 'sidecar']);
      await app.close();
    });
  });

  test('window.open and navigation away from the app are blocked', async () => {
    await withTemp(async (dir) => {
      const { app, page } = await launch(join(dir, 'userData'));
      const before = app.windows().length;
      const opened = await page.evaluate(() => window.open('https://example.com') === null);
      expect(opened).toBe(true);
      await page.evaluate(() => { location.href = 'https://example.com/'; });
      await page.waitForTimeout(500);
      expect(page.url()).toMatch(/^app:\/\//);
      expect(app.windows().length).toBe(before);
      await app.close();
    });
  });

  test('the CSP stops the renderer reaching any remote origin', async () => {
    await withTemp(async (dir) => {
      const { app, page } = await launch(join(dir, 'userData'));
      const outcome = await page.evaluate(async () => {
        try {
          await fetch('https://example.com/');
          return 'fetched';
        } catch {
          return 'blocked';
        }
      });
      expect(outcome).toBe('blocked');
      const csp = await page.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("object-src 'none'");
      await app.close();
    });
  });

  test('bad requests over the bridge come back as coded errors, and the bridge cannot reach an unknown channel', async () => {
    await withTemp(async (dir) => {
      const { app, page } = await launch(join(dir, 'userData'));
      await expect(page.getByTestId('app')).toBeAttached();
      const results = await page.evaluate(async () => {
        const bridge = (window as unknown as { abBridge: Record<string, Record<string, (input?: unknown) => Promise<{ ok: boolean; error?: { code: string } }>>> }).abBridge;
        return {
          badShape: (await bridge.net.call({ service: 5, operation: 'x' })).error?.code,
          unknownService: (await bridge.net.call({ service: 'nope', operation: 'x' })).error?.code,
          unknownMethod: typeof (bridge.net as Record<string, unknown>).drop,
          unknownGroup: typeof (bridge as Record<string, unknown>).fs,
          noGenericInvoke: typeof (bridge as Record<string, unknown>).invoke,
        };
      });
      expect(results).toEqual({ badShape: 'invalid_request', unknownService: 'unknown_service', unknownMethod: 'undefined', unknownGroup: 'undefined', noGenericInvoke: 'undefined' });
      await app.close();
    });
  });
});

test.describe('electron shell: data destination', () => {
  test('a session and its events sent from the renderer are stored in data.json in the user-data folder', async () => {
    await withTemp(async (dir) => {
      const userData = join(dir, 'userData');
      const { app, page } = await launch(userData);
      await expect(page.getByTestId('app')).toBeAttached();
      const ids = { user_id: crypto.randomUUID(), session_id: crypto.randomUUID() };
      const eventId = crypto.randomUUID();

      const results = await page.evaluate(async ({ ids, eventId }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (window as any).abBridge.data;
        const session = await data.createSession({ ...ids, extra_props: { app_id: 'e2e' } });
        const events = await data.writeEvents({
          ...ids,
          events: [{ id: eventId, index: 0, kind: 'k', props: { n: 1 }, browser_timestamp: '2026-10-27T00:00:00Z' }],
        });
        return { session, events };
      }, { ids, eventId });
      expect(results.session).toEqual({ ok: true, value: ids });
      expect(results.events).toEqual({ ok: true, value: { accepted: 1 } });
      await app.close();

      const file = JSON.parse(await readFile(join(userData, 'data.json'), 'utf8'));
      expect(file.sessions[ids.session_id]).toMatchObject({ user_id: ids.user_id, extra_props: { app_id: 'e2e' } });
      expect(file.events[eventId]).toMatchObject({ session_id: ids.session_id, index: 0, kind: 'k', props: { n: 1 } });
    });
  });

  test('a blank starter screen writes no data file until something is sent', async () => {
    await withTemp(async (dir) => {
      const userData = join(dir, 'userData');
      const { app, page } = await launch(userData);
      await expect(page.getByTestId('app')).toBeAttached();
      await app.close();
      await expect(readFile(join(userData, 'data.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});
