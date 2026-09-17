export const NEW_FOLDER_VALUE = '__new__';
export const FOLDER_NAME_DISPLAY_MAX = 24;

export function truncateFolderName(name, maxLength = FOLDER_NAME_DISPLAY_MAX) {
  const value = typeof name === 'string' ? name : '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function folderSelectAfterChange(currentFolderId, nextValue) {
  if (nextValue === NEW_FOLDER_VALUE) {
    return { creating: true };
  }

  const nextId = nextValue === '' ? null : Number(nextValue);
  return {
    creating: false,
    nextId,
    shouldAssign: nextId !== currentFolderId,
  };
}
