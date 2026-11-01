import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { folderNameProblem } from '../shared/folderName';
import { newStep, parseDendraJson, startStep, stepFolderName, validKind } from '../shared/tree';
import type { CreateStepInput, StepEntry, StepItem, WorkspaceResult, WorkspaceState } from '../shared/types';

const WORKSPACE_FILE = 'dendra.json';

export interface WorkspaceOptions {
  /** Opens a file or folder with the application the system associates with it; resolves with an error message, or an empty string if it worked. */
  openPath: (path: string) => Promise<string>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function failed(error: unknown): WorkspaceResult {
  return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
}

/** The open workspace: a folder holding `dendra.json` and the step folders. */
export class Workspace {
  private root: string | undefined;
  private tree: StepEntry[] = [];

  constructor(private readonly options: WorkspaceOptions) {}

  state(): WorkspaceState | undefined {
    return this.root ? { name: basename(this.root), tree: this.tree } : undefined;
  }

  /** Makes the empty folder the framework's workspace manager has just created a dendra workspace (the start step and `dendra.json`), and opens it. */
  async create(folder: string): Promise<void> {
    try {
      await mkdir(join(folder, stepFolderName(startStep)));
      await writeFile(join(folder, WORKSPACE_FILE), serialise([startStep]));
    } catch (error) {
      await rm(folder, { recursive: true, force: true });
      throw error;
    }
    await this.open(folder);
  }

  /** Opens a folder as the workspace; a folder without `dendra.json` is rejected. */
  async open(folder: string): Promise<void> {
    if (!(await exists(join(folder, WORKSPACE_FILE)))) throw new Error(`That folder is not a dendra workspace: it has no ${WORKSPACE_FILE}.`);
    const tree = parseDendraJson(await readFile(join(folder, WORKSPACE_FILE), 'utf8'));
    this.root = folder;
    this.tree = tree;
  }

  /** Adds a step after (sequential) or beside (branching) the step numbered `input.preceding`. */
  async createStep(input: CreateStepInput): Promise<WorkspaceResult> {
    try {
      const root = this.requireRoot();
      const preceding = this.requireStep(input.preceding);
      const problem = folderNameProblem(input.name);
      if (problem) throw new Error(problem);
      if (validKind(this.tree, preceding) !== input.kind) throw new Error(`A ${input.kind} step cannot be created from step ${preceding.number}.`);
      const step = newStep(this.tree, preceding, input.kind, input.name);
      const folderProblem = folderNameProblem(stepFolderName(step));
      if (folderProblem) throw new Error(folderProblem);

      const folder = join(root, stepFolderName(step));
      await mkdir(folder);
      try {
        if (input.kind === 'sequential') {
          const source = join(root, stepFolderName(preceding));
          const available = new Set(await readdir(source));
          for (const name of input.copy) {
            if (!available.has(name)) throw new Error(`${name} is not in the folder of step ${preceding.number}.`);
            await cp(join(source, name), join(folder, name), { recursive: true, errorOnExist: true, force: false });
          }
        }
        const tree = [...this.tree, step];
        await writeFile(join(root, WORKSPACE_FILE), serialise(tree));
        this.tree = tree;
      } catch (error) {
        await rm(folder, { recursive: true, force: true });
        throw error;
      }
      return { status: 'done', workspace: this.state()! };
    } catch (error) {
      return failed(error);
    }
  }

  /** The files and folders in a step's folder. */
  async listStep(number: string): Promise<StepItem[]> {
    const entries = await readdir(this.stepFolder(number), { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, folder: entry.isDirectory() }));
  }

  async openStepFolder(number: string): Promise<void> {
    await this.openInSystem(this.stepFolder(number));
  }

  /** Opens one file or folder from a step's folder. Only a name that is in the folder is opened. */
  async openStepItem(number: string, name: string): Promise<void> {
    const folder = this.stepFolder(number);
    if (!(await readdir(folder)).includes(name)) throw new Error(`${name} is not in the folder of step ${number}.`);
    await this.openInSystem(join(folder, name));
  }

  private async openInSystem(path: string): Promise<void> {
    const problem = await this.options.openPath(path);
    if (problem) throw new Error(problem);
  }

  private requireRoot(): string {
    if (!this.root) throw new Error('No workspace is open.');
    return this.root;
  }

  private requireStep(number: string): StepEntry {
    const step = this.tree.find((entry) => entry.number === number);
    if (!step) throw new Error(`There is no step ${number}.`);
    return step;
  }

  private stepFolder(number: string): string {
    return join(this.requireRoot(), stepFolderName(this.requireStep(number)));
  }
}

function serialise(tree: StepEntry[]): string {
  return JSON.stringify({ tree }, null, 2) + '\n';
}
