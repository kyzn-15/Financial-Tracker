export const NEW_FOLDER_VALUE: '__new__';
export const FOLDER_NAME_DISPLAY_MAX: 24;

export function truncateFolderName(name: string, maxLength?: number): string;

export function folderSelectAfterChange(
  currentFolderId: number | null,
  nextValue: string,
): { creating: true } | { creating: false; nextId: number | null; shouldAssign: boolean };
