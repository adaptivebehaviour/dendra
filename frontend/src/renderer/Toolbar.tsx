import type { ReactNode } from 'react';
import newFolderIcon from './icons/folder-plus.svg';
import openFolderIcon from './icons/folder-open.svg';

function ToolbarButton({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded p-1.5 hover:bg-gray-200">
      {children}
      </button>
  );
}

/** The horizontal strip of buttons at the top of the screen. */
export function Toolbar({ onNewWorkspace, onOpenWorkspace }: { onNewWorkspace(): void; onOpenWorkspace(): void }) {
  return (
    <div role="toolbar" className="flex items-center gap-1 border-b border-gray-300 p-1" data-testid="toolbar">
      <ToolbarButton label="New workspace" onClick={onNewWorkspace}>
        <img src={newFolderIcon} alt="" className="h-5 w-5" />
      </ToolbarButton>
      <ToolbarButton label="Open workspace" onClick={onOpenWorkspace}>
        <img src={openFolderIcon} alt="" className="h-5 w-5" />
      </ToolbarButton>
      <div role="separator" aria-orientation="vertical" className="mx-1 h-6 w-px bg-gray-300" />
    </div>
  );
}
