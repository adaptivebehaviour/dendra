import { buildBridge } from '@adaptivebehaviour/desktop/src/ipc/index';
import { contextBridge, ipcRenderer } from 'electron';
import type { WorkspaceBridge } from '../shared/types';

// The only bridge between the renderer and the main process: one named function per channel in the IPC contract,
// each of which resolves with a plain result. There is no generic "invoke any channel" function, and nothing
// from Node or Electron is exposed.
contextBridge.exposeInMainWorld('abBridge', buildBridge((channel, payload) => ipcRenderer.invoke(channel, payload)));

// The workspace: one named function per operation, each invoking its own channel. The renderer never supplies a path.
const workspaceBridge: WorkspaceBridge = {
  current: () => ipcRenderer.invoke('dendra:workspace.current'),
  createStep: (input) => ipcRenderer.invoke('dendra:workspace.createStep', input),
  listStep: (number) => ipcRenderer.invoke('dendra:workspace.listStep', number),
  openStepFolder: (number) => ipcRenderer.invoke('dendra:workspace.openStepFolder', number),
  openStepItem: (number, name) => ipcRenderer.invoke('dendra:workspace.openStepItem', number, name),
};
contextBridge.exposeInMainWorld('workspaceBridge', workspaceBridge);
