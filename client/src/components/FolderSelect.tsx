import { useState } from 'react';
import type { ExpenseFolder } from '../types';
import { getErrorMessage } from '../utils/errors';
import { NEW_FOLDER_VALUE, folderSelectAfterChange, truncateFolderName } from '../utils/folderSelect';

interface FolderSelectProps {
  folders: ExpenseFolder[];
  value: number | null;
  disabled?: boolean;
  ariaLabel?: string;
  onAssign: (folderId: number | null) => Promise<unknown>;
  onCreateAndAssign: (name: string) => Promise<unknown>;
}

export default function FolderSelect({
  folders,
  value,
  disabled = false,
  ariaLabel = 'Folder',
  onAssign,
  onCreateAndAssign,
}: FolderSelectProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = value == null ? '' : String(value);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update folder.'));
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (nextValue: string) => {
    const next = folderSelectAfterChange(value, nextValue);
    if (next.creating) {
      setCreating(true);
      setError('');
      return;
    }
    setCreating(false);
    setNewName('');
    setError('');
    if (!next.shouldAssign) return;
    void run(() => onAssign(next.nextId));
  };

  const handleCreate = () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60) {
      setError('Folder name must be between 1 and 60 characters.');
      return;
    }
    void run(async () => {
      await onCreateAndAssign(name);
      setCreating(false);
      setNewName('');
    });
  };

  return (
    <div className="expense-folder-select">
      <select
        className="neo-select"
        value={creating ? NEW_FOLDER_VALUE : selected}
        onChange={(event) => handleChange(event.target.value)}
        disabled={disabled || busy}
        aria-label={ariaLabel}
      >
        <option value="">No folder</option>
        {folders.map((folder) => (
          <option key={folder.id} value={String(folder.id)} title={folder.name}>
            {truncateFolderName(folder.name)}
          </option>
        ))}
        <option value={NEW_FOLDER_VALUE}>New folder…</option>
      </select>
      {creating && (
        <div className="expense-folder-select__create">
          <input
            type="text"
            className="neo-input"
            maxLength={60}
            placeholder="Folder name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={disabled || busy}
            aria-label="New folder name"
          />
          <button className="neo-btn neo-btn--primary neo-btn--sm" type="button" onClick={handleCreate} disabled={disabled || busy}>
            Add
          </button>
          <button
            className="neo-btn neo-btn--secondary neo-btn--sm"
            type="button"
            onClick={() => { setCreating(false); setNewName(''); setError(''); }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="expense-folder-select__error">{error}</p>}
    </div>
  );
}
