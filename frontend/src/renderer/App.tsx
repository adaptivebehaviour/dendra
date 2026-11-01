import { useEffect, useState } from 'react';
import type { StepKind } from '../shared/tree';
import type { StepEntry, WorkspaceResult, WorkspaceState } from '../shared/types';
import { ab } from './ab';
import { MessageDialog, StepDialog } from './Dialogs';
import { NewWorkspaceDialog } from './NewWorkspaceDialog';
import { StepTree } from './StepTree';
import { Toolbar } from './Toolbar';

type DialogState = { dialog: 'step'; kind: StepKind; preceding: StepEntry };

/** The screen is a toolbar across the top, and below it the steps of the open workspace (nothing at all when none is open). */
export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [dialog, setDialog] = useState<DialogState>();
  // The location the "new workspace" dialog starts with; `null` while the dialog is closed.
  const [newWorkspaceLocation, setNewWorkspaceLocation] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

  // The main process has already reopened the last workspace opened, if there is one.
  useEffect(() => {
    void window.workspaceBridge.current().then(setWorkspace, () => setMessage('Could not read the workspace.'));
  }, []);

  /** Shows the error of a failed call to the main process. */
  const report = (error: unknown) => setMessage(error instanceof Error ? error.message : 'Something went wrong.');

  const newWorkspace = async () => {
    try {
      setNewWorkspaceLocation((await ab.workspace.beginNew()).location);
    } catch (error) {
      report(error);
    }
  };

  const openWorkspace = async () => {
    try {
      if (await ab.workspace.open()) setWorkspace(await window.workspaceBridge.current());
    } catch (error) {
      report(error);
    }
  };

  /** Applies the outcome of a step operation: a cancelled one changes nothing. */
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
      <Toolbar onNewWorkspace={() => void newWorkspace()} onOpenWorkspace={() => void openWorkspace()} />
      {workspace && <StepTree tree={workspace.tree} onCreate={(preceding, kind) => setDialog({ dialog: 'step', kind, preceding })} onError={setMessage} />}

      {newWorkspaceLocation !== null && (
        <NewWorkspaceDialog
          initialLocation={newWorkspaceLocation}
          onChooseLocation={async () => (await ab.workspace.chooseLocation())?.location ?? null}
          onCreate={async (name) => {
            await ab.workspace.create({ name });
            setNewWorkspaceLocation(null);
            setWorkspace(await window.workspaceBridge.current());
          }}
          onCancel={() => setNewWorkspaceLocation(null)}
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
