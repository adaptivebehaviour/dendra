import { useEffect, useRef, useState, type ReactNode } from 'react';
import { folderNameProblem } from '../shared/folderName';
import type { StepEntry, StepItem } from '../shared/types';

const dialogClass = 'm-auto w-80 rounded p-4 shadow-lg backdrop:bg-black/30';
const cancelClass = 'rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100';
const submitClass = 'rounded bg-slate-900 px-3 py-1.5 text-white';

interface NameDialogProps {
  testId: string;
  label: string;
  submitLabel: string;
  /** Called with a name that is valid as a folder name. */
  onSubmit: (name: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** A modal asking for a name. A name that is not valid as a folder name is not accepted: the problem is shown and the user enters another. */
function NameDialog({ testId, label, submitLabel, onSubmit, onCancel, children }: NameDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} onClose={onCancel} data-testid={testId} className={dialogClass}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const found = folderNameProblem(name);
          if (found) setProblem(found);
          else onSubmit(name);
        }}
      >
        <label className="flex flex-col gap-1">
          {label}
          <input
            autoFocus
            data-testid="name-input"
            value={name}
            aria-invalid={problem !== undefined}
            aria-describedby={problem ? 'name-problem' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setProblem(undefined);
            }}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        {problem && (
          <p id="name-problem" role="alert" data-testid="name-problem" className="text-sm text-red-700">
            {problem}
          </p>
        )}
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" className={cancelClass} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" data-testid="name-submit" className={submitClass}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Asks for the name of a new workspace (PRD 5.1, 6.2). */
export function NewWorkspaceDialog({ onSubmit, onCancel }: { onSubmit: (name: string) => void; onCancel: () => void }) {
  return <NameDialog testId="new-dialog" label="Workspace name" submitLabel="Next" onSubmit={onSubmit} onCancel={onCancel} />;
}

interface StepDialogProps {
  kind: 'sequential' | 'branching';
  /** The step the user right-clicked. */
  preceding: StepEntry;
  onSubmit: (name: string, copy: string[]) => void;
  onCancel: () => void;
}

/**
 * Asks for the name of a new step (PRD 6.5, 6.6). For a sequential step it also lists the files and folders in the
 * preceding step's folder, so the user can select the ones to copy.
 */
export function StepDialog({ kind, preceding, onSubmit, onCancel }: StepDialogProps) {
  const [items, setItems] = useState<StepItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (kind !== 'sequential') return;
    void window.workspaceBridge.listStep(preceding.number).then(setItems, () => setItems([]));
  }, [kind, preceding.number]);

  return (
    <NameDialog
      testId={`${kind}-dialog`}
      label="Step name"
      submitLabel="Create"
      onSubmit={(name) => onSubmit(name, kind === 'sequential' ? selected : [])}
      onCancel={onCancel}
    >
      {kind === 'sequential' && items.length > 0 && (
        <fieldset className="flex max-h-48 flex-col gap-1 overflow-auto" data-testid="copy-list">
          <legend className="mb-1">Copy from step {preceding.number}</legend>
          {items.map((item) => (
            <label key={item.name} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(item.name)}
                onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.name] : current.filter((name) => name !== item.name)))}
              />
              {item.folder ? `${item.name}\\` : item.name}
            </label>
          ))}
        </fieldset>
      )}
    </NameDialog>
  );
}

/** Tells the user why something did not work. */
export function MessageDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} onClose={onClose} data-testid="message-dialog" className={dialogClass}>
      <div className="flex flex-col gap-3">
        <p role="alert" data-testid="message-text">
          {message}
        </p>
        <div className="flex justify-end">
          <button type="button" autoFocus className={submitClass} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </dialog>
  );
}
