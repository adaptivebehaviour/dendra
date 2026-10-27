import { createHandlers } from '@adaptivebehaviour/desktop/src/main/index';
import { registerHandlers, type IpcEventLike } from '@adaptivebehaviour/desktop/src/ipc/index';
import { buildCsp, EnvironmentCredentials, NetworkServices } from '@adaptivebehaviour/desktop/src/net/index';
import { app, BrowserWindow, dialog, ipcMain, net as electronNet, protocol, session, shell } from 'electron';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CreateStepInput } from '../shared/types';
import { APP_NAME, destination, externalLinkOrigins, services } from './config';
import { createDestination } from './data';
import { createSidecar } from './sidecar';
import { Workspace } from './workspace';

const APP_ORIGIN = 'app://app';
// In development the renderer is served by the Vite dev server; in a build it is served from the app:// protocol.
const devUrl = (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) || undefined;

// Must run before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const log = (...parts: unknown[]) => console.log(new Date().toISOString(), ...parts);

function isAppUrl(url: string): boolean {
  return url.startsWith(`${APP_ORIGIN}/`) || (devUrl !== undefined && url.startsWith(devUrl));
}

async function pickFolder(purpose: 'create' | 'open'): Promise<string | undefined> {
  const options: Electron.OpenDialogOptions = {
    title: purpose === 'create' ? 'Choose where to create the workspace' : 'Choose a workspace folder',
    properties: purpose === 'create' ? ['openDirectory', 'createDirectory'] : ['openDirectory'],
  };
  const window = BrowserWindow.getFocusedWindow();
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}

function isCreateStepInput(value: unknown): value is CreateStepInput {
  const input = value as Partial<CreateStepInput> | null;
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof input.preceding === 'string' &&
    (input.kind === 'sequential' || input.kind === 'branching') &&
    typeof input.name === 'string' &&
    Array.isArray(input.copy) &&
    input.copy.every((name) => typeof name === 'string')
  );
}

function serveRenderer(): void {
  const rendererRoot = join(__dirname, '../renderer');
  const csp = buildCsp(services);
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    const requested = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const file = join(rendererRoot, requested);
    if (file !== rendererRoot && !file.startsWith(rendererRoot + sep)) return new Response('Forbidden', { status: 403 });
    const upstream = await electronNet.fetch(pathToFileURL(file).toString());
    const headers = new Headers(upstream.headers);
    headers.set('Content-Security-Policy', csp);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(upstream.body, { status: upstream.status, headers });
  });
}

function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  if (devUrl) {
    const csp = buildCsp(services, { dev: { origin: new URL(devUrl).origin } });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      if (details.url.startsWith(devUrl)) headers['Content-Security-Policy'] = [csp];
      callback({ responseHeaders: headers });
    });
  }
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      try {
        const target = new URL(url);
        if (target.protocol === 'https:' && externalLinkOrigins.includes(target.origin)) void shell.openExternal(url);
      } catch {
        // an unparseable URL is simply denied
      }
      return { action: 'deny' };
    });
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(devUrl ?? `${APP_ORIGIN}/index.html`);
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(async () => {
    // The Python backend (if the application has one) lives and dies with the app.
    const sidecar = createSidecar({
      log,
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      allowedEnv: services.flatMap((service) => (service.credential ? [service.credential.env] : [])),
    });
    const net = new NetworkServices({ services, credentials: new EnvironmentCredentials(), log });
    // The one data destination (see config.ts); the renderer reaches it only through the `data.*` channels.
    const data = createDestination(destination, { userData: app.getPath('userData') });
    await data.start?.().catch((error) => log('[data] could not start:', error instanceof Error ? error.message : error));
    const handlers = createHandlers({
      app: { name: APP_NAME, version: app.getVersion(), platform: process.platform },
      net,
      sidecar,
      data,
    });
    registerHandlers(ipcMain, handlers, {
      isTrustedSender: (event: IpcEventLike) => isAppUrl(event.senderFrame?.url ?? ''),
      onError: (channel, error) => log(`[ipc] ${channel} failed:`, error instanceof Error ? error.message : error),
    });

    // The workspace is a folder the user picks; the last one is reopened at startup. The renderer reaches it only
    // through the `dendra:workspace.*` channels below, never with a path of its own.
    const workspace = new Workspace({
      settingsFile: join(app.getPath('userData'), 'last-workspace.json'),
      pickFolder,
      openPath: (path) => shell.openPath(path),
      onError: (error) => log('[workspace]', error instanceof Error ? error.message : error),
    });
    const handle = (name: string, handler: (...args: unknown[]) => unknown) =>
      ipcMain.handle(`dendra:workspace.${name}`, (event, ...args: unknown[]) => {
        if (!isAppUrl(event.senderFrame?.url ?? '')) throw new Error('Untrusted sender');
        return handler(...args);
      });
    handle('current', () => workspace.state());
    handle('create', (name) => (typeof name === 'string' ? workspace.create(name) : Promise.reject(new Error('Invalid workspace name'))));
    handle('open', () => workspace.open());
    handle('createStep', (input) => (isCreateStepInput(input) ? workspace.createStep(input) : Promise.reject(new Error('Invalid step'))));
    handle('listStep', (number) => (typeof number === 'string' ? workspace.listStep(number) : Promise.reject(new Error('Invalid step number'))));
    handle('openStepFolder', (number) => (typeof number === 'string' ? workspace.openStepFolder(number) : Promise.reject(new Error('Invalid step number'))));
    handle('openStepItem', (number, name) =>
      typeof number === 'string' && typeof name === 'string' ? workspace.openStepItem(number, name) : Promise.reject(new Error('Invalid step item')),
    );
    try {
      await workspace.reopenLast();
    } catch (error) {
      log('[workspace] could not reopen the last workspace:', error instanceof Error ? error.message : error);
    }

    hardenSession();
    if (!devUrl) serveRenderer();
    const window = createWindow();

    app.on('second-instance', () => {
      if (window.isMinimized()) window.restore();
      window.focus();
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    void sidecar?.start().catch((error) => log('[sidecar] could not start:', error instanceof Error ? error.message : error));

    // Stop the Python backend (if any) and the data destination before the process exits.
    let closing = false;
    app.on('before-quit', (event) => {
      if (closing) return;
      event.preventDefault();
      closing = true;
      void Promise.allSettled([sidecar?.stop(), data.stop?.()]).finally(() => app.quit());
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
