import type { AbBridge } from '@adaptivebehaviour/desktop/src/ipc/index';
import type { WorkspaceBridge } from '../shared/types';

declare global {
  interface Window {
    /** Exposed by the preload script; wrapped into `ab` (see ab.ts). Not for direct use. */
    abBridge: AbBridge;
    /** Exposed by the preload script: the workspace operations (see `src/shared/types.ts`). */
    workspaceBridge: WorkspaceBridge;
  }
}
