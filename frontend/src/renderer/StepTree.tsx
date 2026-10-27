import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { hasFollower, validKind, type StepKind } from '../shared/tree';
import type { StepEntry, StepItem } from '../shared/types';
import { layoutTree } from './layout';

/** The width of a step rectangle, and of the gap in which a horizontal line links two of them. */
const STEP_WIDTH = 100;
const GAP_WIDTH = 24;
/** The height of the gap in which a vertical line links two steps. */
const GAP_HEIGHT = 16;
/** Half the minimum height of a step rectangle: where a horizontal line meets it. */
const LINE_OFFSET = 16;

interface Menu {
  step: StepEntry;
  kind: StepKind;
  x: number;
  y: number;
}

interface Popup {
  step: StepEntry;
  items: StepItem[];
  x: number;
  y: number;
}

interface StepTreeProps {
  tree: StepEntry[];
  /** The user chose to create a step from `step`. */
  onCreate: (step: StepEntry, kind: StepKind) => void;
  onError: (message: string) => void;
}

/** The steps as rectangles in a vertical tree (PRD 6.3), with the click, double-click and right-click interactions (PRD 6.4). */
export function StepTree({ tree, onCreate, onError }: StepTreeProps) {
  const layout = useMemo(() => layoutTree(tree), [tree]);
  const [menu, setMenu] = useState<Menu>();
  const [popup, setPopup] = useState<Popup>();
  const floating = useRef<HTMLDivElement>(null);
  // A folder listing that arrives after the user has moved on (a double-click, a right-click) is dropped.
  const latest = useRef(0);

  // A popup closes when the user clicks anywhere else or presses Escape.
  useEffect(() => {
    if (!menu && !popup) return;
    const close = () => {
      latest.current += 1;
      setMenu(undefined);
      setPopup(undefined);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!floating.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, popup]);

  const reach = Math.max(-layout.minCol, layout.maxCol);
  const column = (col: number) => 2 * (col + reach) + 1;
  const row = (r: number) => 2 * r + 1;
  const columns = Array.from({ length: 2 * (2 * reach + 1) - 1 }, (_, track) => (track % 2 === 0 ? `${STEP_WIDTH}px` : `${GAP_WIDTH}px`));
  const rows = Array.from({ length: 2 * (layout.maxRow + 1) - 1 }, (_, track) => (track % 2 === 0 ? 'auto' : `${GAP_HEIGHT}px`));

  function onClick(event: MouseEvent<HTMLButtonElement>, step: StepEntry) {
    if (event.detail > 1) return; // the second click of a double-click
    const box = event.currentTarget.getBoundingClientRect();
    const request = (latest.current += 1);
    setMenu(undefined);
    window.workspaceBridge.listStep(step.number).then(
      (items) => {
        if (request === latest.current) setPopup({ step, items, x: box.left, y: box.bottom + 4 });
      },
      () => {
        if (request === latest.current) onError(`Could not read the folder of step ${step.number}.`);
      },
    );
  }

  function onDoubleClick(step: StepEntry) {
    latest.current += 1;
    setPopup(undefined);
    window.workspaceBridge.openStepFolder(step.number).catch(() => onError(`Could not open the folder of step ${step.number}.`));
  }

  function onContextMenu(event: MouseEvent<HTMLButtonElement>, step: StepEntry) {
    event.preventDefault();
    latest.current += 1;
    setPopup(undefined);
    const kind = validKind(tree, step);
    setMenu(kind ? { step, kind, x: event.clientX, y: event.clientY } : undefined);
  }

  function openItem(step: StepEntry, item: StepItem) {
    latest.current += 1;
    setPopup(undefined);
    window.workspaceBridge.openStepItem(step.number, item.name).catch(() => onError(`Could not open ${item.name}.`));
  }

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="step-display">
      <div className="mx-auto grid w-max" style={{ gridTemplateColumns: columns.join(' '), gridTemplateRows: rows.join(' ') }}>
        {layout.lines.map((line, index) =>
          line.kind === 'vertical' ? (
            <div
              key={index}
              aria-hidden="true"
              data-testid="line-vertical"
              className="w-px justify-self-center bg-slate-400"
              style={{ gridColumn: column(line.col), gridRow: `${row(line.fromRow) + 1} / ${row(line.toRow)}` }}
            />
          ) : (
            <div
              key={index}
              aria-hidden="true"
              data-testid="line-horizontal"
              className="h-px self-start bg-slate-400"
              style={{ gridColumn: `${column(line.fromCol) + 1} / ${column(line.toCol)}`, gridRow: row(line.row), marginTop: LINE_OFFSET }}
            />
          ),
        )}
        {layout.steps.map(({ step, col, row: r }) => (
          // The cell fills its row, so the line to a follower runs from the rectangle's bottom edge to the next row even when a taller rectangle shares the row.
          <div key={step.number} className="flex flex-col" style={{ gridColumn: column(col), gridRow: row(r) }}>
            <button
              type="button"
              data-testid={`step-${step.number}`}
              className="min-h-8 rounded border border-slate-400 bg-white px-1.5 py-1 text-left text-sm leading-5 hover:bg-slate-50"
              onClick={(event) => onClick(event, step)}
              onDoubleClick={() => onDoubleClick(step)}
              onContextMenu={(event) => onContextMenu(event, step)}
            >
              <span className="line-clamp-2 [overflow-wrap:anywhere]">
                {step.number} {step.name}
              </span>
            </button>
            {hasFollower(tree, step) && <div aria-hidden="true" className="mx-auto w-px flex-1 bg-slate-400" />}
          </div>
        ))}
      </div>

      {menu && (
        <div ref={floating} role="menu" data-testid="step-menu" className="fixed z-10 rounded border border-slate-300 bg-white py-1 shadow-lg" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            role="menuitem"
            data-testid={`create-${menu.kind}`}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => {
              setMenu(undefined);
              onCreate(menu.step, menu.kind);
            }}
          >
            Create {menu.kind} step
          </button>
        </div>
      )}

      {popup && (
        <div ref={floating} data-testid="step-contents" className="fixed z-10 max-h-64 min-w-40 max-w-80 overflow-auto rounded border border-slate-300 bg-white py-1 shadow-lg" style={{ left: popup.x, top: popup.y }}>
          {popup.items.map((item) => (
            <button key={item.name} type="button" className="block w-full truncate px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => openItem(popup.step, item)}>
              {item.folder ? `${item.name}\\` : item.name}
            </button>
          ))}
          {popup.items.length === 0 && <p className="px-3 py-1.5 text-slate-500">Empty</p>}
        </div>
      )}
    </div>
  );
}
