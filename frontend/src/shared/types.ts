/** One entry in the `tree` of `dendra.json`. */
export interface StepEntry {
  /** The step's position in the process, e.g. `0`, `4`, `4a.0`, `4b.2a.1`. */
  number: string;
  name: string;
  type: 'sequential' | 'branching';
  /** The number of the preceding step; absent for the start step. */
  preceding?: string;
  /** Which side of its preceding step a branching step is located on; absent for a sequential step. */
  side?: 'left' | 'right';
}

/** The open workspace as the renderer sees it. */
export interface WorkspaceState {
  name: string;
  tree: StepEntry[];
}

/** A file or folder in a step folder. */
export interface StepItem {
  name: string;
  folder: boolean;
}

/** `done` carries the new state; `cancelled` means the user backed out and nothing changed; `failed` carries a message for the user. */
export type WorkspaceResult =
  | { status: 'done'; workspace: WorkspaceState }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export interface CreateStepInput {
  /** The number of the step the user right-clicked. */
  preceding: string;
  kind: 'sequential' | 'branching';
  name: string;
  /** Names of the files and folders to copy from the preceding step's folder (sequential steps only). */
  copy: string[];
}

/** The functions the preload script exposes to the renderer as `window.workspaceBridge`. */
export interface WorkspaceBridge {
  current(): Promise<WorkspaceState | undefined>;
  create(name: string): Promise<WorkspaceResult>;
  open(): Promise<WorkspaceResult>;
  createStep(input: CreateStepInput): Promise<WorkspaceResult>;
  listStep(number: string): Promise<StepItem[]>;
  openStepFolder(number: string): Promise<void>;
  openStepItem(number: string, name: string): Promise<void>;
}
