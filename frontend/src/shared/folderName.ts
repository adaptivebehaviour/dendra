const MAX_LENGTH = 255;
const INVALID_CHARACTERS = /[<>:"/\\|?*\x00-\x1f]/;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Why `name` cannot be a folder name, or `undefined` if it can. */
export function folderNameProblem(name: string): string | undefined {
  if (name.trim() === '') return 'Enter a name.';
  if (name !== name.trim() || name.endsWith('.')) return 'A name cannot start or end with a space, or end with a full stop.';
  if (name.length > MAX_LENGTH) return `A name cannot be longer than ${MAX_LENGTH} characters.`;
  if (INVALID_CHARACTERS.test(name)) return 'A name cannot contain any of < > : " / \\ | ? *';
  if (RESERVED_NAMES.test(name)) return 'That name is reserved by Windows.';
  return undefined;
}
