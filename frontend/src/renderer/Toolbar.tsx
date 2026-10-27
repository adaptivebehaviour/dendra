import { Icon } from './icons';

/** A horizontal toolbar of icon-only buttons (labelled for assistive technology, with no visible text). */
export function Toolbar({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  const button = 'inline-flex h-9 w-9 items-center justify-center rounded hover:bg-black/10';
  return (
    <div role="toolbar" aria-label="Toolbar" data-testid="toolbar" className="flex flex-row items-center gap-1 border-b border-black/10 p-1">
      <button type="button" aria-label="New" title="New" data-testid="new-button" className={button} onClick={onNew}>
        <Icon name="new" />
      </button>
      <button type="button" aria-label="Open" title="Open" data-testid="open-button" className={button} onClick={onOpen}>
        <Icon name="open" />
      </button>
    </div>
  );
}
