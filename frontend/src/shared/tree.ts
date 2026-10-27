import type { StepEntry } from './types';

export type StepKind = 'sequential' | 'branching';

/** The step folder: step number, an underscore, then the step name (e.g. `4a.0_name`). */
export function stepFolderName(step: StepEntry): string {
  return `${step.number}_${step.name}`;
}

/** A step has a follower only when a sequential step follows it; a branching step is not a follower. */
export function hasFollower(tree: StepEntry[], step: StepEntry): boolean {
  return tree.some((entry) => entry.type === 'sequential' && entry.preceding === step.number);
}

/** The one kind of step that may be created from `step`, or `undefined` if none (PRD 6.4). */
export function validKind(tree: StepEntry[], step: StepEntry): StepKind | undefined {
  if (!hasFollower(tree, step)) return 'sequential';
  return step.type === 'branching' ? undefined : 'branching';
}

/** The preceding number plus 1 outside a branch; within a branch, the number after the furthest dot to the right plus 1. */
export function sequentialNumber(preceding: string): string {
  const dot = preceding.lastIndexOf('.');
  if (dot < 0) return String(Number(preceding) + 1);
  return `${preceding.slice(0, dot + 1)}${Number(preceding.slice(dot + 1)) + 1}`;
}

/** `a` to `z`, then `aa`, `ab`, and so on. */
export function branchLetters(index: number): string {
  let rest = index + 1;
  let letters = '';
  while (rest > 0) {
    rest -= 1;
    letters = String.fromCharCode(97 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  }
  return letters;
}

/** The first branching step from a step goes to a random side; later ones alternate. */
function nextSide(tree: StepEntry[], precedingNumber: string, random: () => number): 'left' | 'right' {
  const earlier = tree.filter((entry) => entry.type === 'branching' && entry.preceding === precedingNumber);
  const last = earlier[earlier.length - 1];
  if (!last) return random() < 0.5 ? 'left' : 'right';
  return last.side === 'left' ? 'right' : 'left';
}

/** The tree entry for a new step created from `preceding`. The caller checks `kind` against `validKind` first. */
export function newStep(tree: StepEntry[], preceding: StepEntry, kind: StepKind, name: string, random: () => number = Math.random): StepEntry {
  if (kind === 'sequential') return { number: sequentialNumber(preceding.number), name, type: 'sequential', preceding: preceding.number };
  const count = tree.filter((entry) => entry.type === 'branching' && entry.preceding === preceding.number).length;
  return {
    number: `${preceding.number}${branchLetters(count)}.0`,
    name,
    type: 'branching',
    preceding: preceding.number,
    side: nextSide(tree, preceding.number, random),
  };
}

/** The initial step of a new workspace. */
export const startStep: StepEntry = { number: '0', name: 'start', type: 'sequential' };

/** Parses the text of `dendra.json`, throwing if it is not a workspace file. */
export function parseDendraJson(text: string): StepEntry[] {
  const invalid = () => new Error('dendra.json is not valid.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw invalid();
  }
  const tree = (data as { tree?: unknown } | null)?.tree;
  if (!Array.isArray(tree) || tree.length === 0) throw invalid();
  // Entries are in creation order: each follows the step it names as preceding, and the first (the start step) names none.
  const earlier = new Set<string>();
  for (const entry of tree as Record<string, unknown>[]) {
    const valid =
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry['number'] === 'string' &&
      !earlier.has(entry['number']) &&
      typeof entry['name'] === 'string' &&
      (entry['type'] === 'sequential' || entry['type'] === 'branching') &&
      (earlier.size === 0 ? entry['preceding'] === undefined : typeof entry['preceding'] === 'string' && earlier.has(entry['preceding'])) &&
      (entry['side'] === undefined || entry['side'] === 'left' || entry['side'] === 'right');
    if (!valid) throw invalid();
    earlier.add(entry['number'] as string);
  }
  return tree as StepEntry[];
}
