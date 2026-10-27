import { useEffect, useState } from 'react';
import type { StepKind } from '../shared/tree';
import type { StepEntry, WorkspaceResult, WorkspaceState } from '../shared/types';
import { MessageDialog, NewWorkspaceDialog, StepDialog } from './Dialogs';
import { StepTree } from './StepTree';
import { Toolbar } from './Toolbar';

type DialogState = { dialog: 'new' } | { dialog: 'step'; kind: StepKind; preceding: StepEntry };

/** The screen is a toolbar across the top, and below it the steps of the open workspace (nothing at all when none is open). */
export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [dialog, setDialog] = useState<DialogState>();
  const [message, setMessage] = useState<string>();

  // The main process has already reopened the last workspace opened, if there is one.
  useEffect(() => {
    void window.workspaceBridge.current().then(setWorkspace, () => setMessage('Could not read the workspace.'));
  }, []);

  /** Applies the outcome of a workspace operation: a cancelled one changes nothing. */
  async function apply(action: Promise<WorkspaceResult>) {
    try {
      const result = await action;
      if (result.status === 'done') setWorkspace(result.workspace);
      else if (result.status === 'failed') setMessage(result.message);
    } catch {
      setMessage('Something went wrong.');
    }
  }

  return (
    <main className="flex min-h-screen flex-col" data-testid="app">
      <Toolbar onNew={() => setDialog({ dialog: 'new' })} onOpen={() => void apply(window.workspaceBridge.open())} />
      {workspace && <StepTree tree={workspace.tree} onCreate={(preceding, kind) => setDialog({ dialog: 'step', kind, preceding })} onError={setMessage} />}

      {dialog?.dialog === 'new' && (
        <NewWorkspaceDialog
          onSubmit={(name) => {
            setDialog(undefined);
            void apply(window.workspaceBridge.create(name));
          }}
          onCancel={() => setDialog(undefined)}
        />
      )}
      {dialog?.dialog === 'step' && (
        <StepDialog
          kind={dialog.kind}
          preceding={dialog.preceding}
          onSubmit={(name, copy) => {
            setDialog(undefined);
            void apply(window.workspaceBridge.createStep({ preceding: dialog.preceding.number, kind: dialog.kind, name, copy }));
          }}
          onCancel={() => setDialog(undefined)}
        />
      )}
      {message && <MessageDialog message={message} onClose={() => setMessage(undefined)} />}
    </main>
  );
}
