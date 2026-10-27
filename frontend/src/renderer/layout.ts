import type { StepEntry } from '../shared/types';

export interface PlacedStep {
  step: StepEntry;
  /** Columns count from the start step's column (0); negative is to its left. */
  col: number;
  /** Rows count down from the start step's row (0). */
  row: number;
}

/** A vertical line in `col` from the box in `fromRow` to the box in `toRow`, or a horizontal line in `row` from the box in `fromCol` to the box in `toCol`. */
export type Line = { kind: 'vertical'; col: number; fromRow: number; toRow: number } | { kind: 'horizontal'; row: number; fromCol: number; toCol: number };

export interface TreeLayout {
  steps: PlacedStep[];
  lines: Line[];
  minCol: number;
  maxCol: number;
  maxRow: number;
}

interface Chain {
  steps: PlacedStep[];
  lines: Line[];
  minCol: number;
  maxCol: number;
  bottom: number;
}

function shifted(line: Line, cols: number, rows: number): Line {
  return line.kind === 'vertical'
    ? { ...line, col: line.col + cols, fromRow: line.fromRow + rows, toRow: line.toRow + rows }
    : { ...line, row: line.row + rows, fromCol: line.fromCol + cols, toCol: line.toCol + cols };
}

/**
 * Lays out the chain of sequential steps that starts at `first`, in column 0 and from row 0, together with every
 * branch off it. A branch is laid out the same way, then placed beside the step it branches off: beyond the furthest
 * branch already on that side, and clear of the chain itself. The step following a step that has branches is placed
 * below the lowest of them, so a branch never meets a later branch from the same chain.
 */
function layoutChain(tree: StepEntry[], first: StepEntry): Chain {
  const steps: PlacedStep[] = [];
  const lines: Line[] = [];
  let minCol = 0;
  let maxCol = 0;
  let bottom = 0;
  let row = 0;
  let step: StepEntry | undefined = first;

  while (step) {
    steps.push({ step, col: 0, row });
    let below = row;
    const edge = { left: 0, right: 0 };
    const previous = { left: 0, right: 0 };
    for (const branch of tree.filter((entry) => entry.type === 'branching' && entry.preceding === step!.number)) {
      const side = branch.side ?? 'right';
      const sub = layoutChain(tree, branch);
      const offset = side === 'right' ? edge.right + 1 - sub.minCol : edge.left - 1 - sub.maxCol;
      for (const placed of sub.steps) steps.push({ step: placed.step, col: placed.col + offset, row: placed.row + row });
      for (const line of sub.lines) lines.push(shifted(line, offset, row));
      lines.push({ kind: 'horizontal', row, fromCol: Math.min(previous[side], offset), toCol: Math.max(previous[side], offset) });
      previous[side] = offset;
      if (side === 'right') edge.right = sub.maxCol + offset;
      else edge.left = sub.minCol + offset;
      minCol = Math.min(minCol, sub.minCol + offset);
      maxCol = Math.max(maxCol, sub.maxCol + offset);
      below = Math.max(below, row + sub.bottom);
    }
    bottom = Math.max(bottom, below);
    const next: StepEntry | undefined = tree.find((entry) => entry.type === 'sequential' && entry.preceding === step!.number);
    if (next) {
      lines.push({ kind: 'vertical', col: 0, fromRow: row, toRow: below + 1 });
      row = below + 1;
      bottom = Math.max(bottom, row);
    }
    step = next;
  }
  return { steps, lines, minCol, maxCol, bottom };
}

/** Where each step's rectangle goes, and the lines linking them. The first entry in the tree is the start step. */
export function layoutTree(tree: StepEntry[]): TreeLayout {
  const start = tree[0];
  if (!start) return { steps: [], lines: [], minCol: 0, maxCol: 0, maxRow: 0 };
  const chain = layoutChain(tree, start);
  return { steps: chain.steps, lines: chain.lines, minCol: chain.minCol, maxCol: chain.maxCol, maxRow: chain.bottom };
}
