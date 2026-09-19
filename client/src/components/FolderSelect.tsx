import { useId, useState } from 'react';
import type { ExpenseFolder } from '../types';
import { getErrorMessage } from '../utils/errors';
import { folderSelectAfterChange, truncateFolderName } from '../utils/folderSelect';
import AppIcon from './AppIcon';
import Modal from './Modal';

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
  const newNameId = useId();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedFolder = folders.find((folder) => folder.id === value);
  const selectedLabel = selectedFolder?.name ?? 'No folder';

  const closePicker = () => {
    if (busy) return;
    setOpen(false);
    setNewName('');
    setError('');
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setOpen(false);
      setNewName('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update folder.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePick = (nextValue: string) => {
    const next = folderSelectAfterChange(value, nextValue);
    if (next.creating || !next.shouldAssign) {
      closePicker();
      return;
    }
    void run(() => onAssign(next.nextId));
  };

  const handleCreate = () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60) {
      setError('Folder name must be between 1 and 60 characters.');
      return;
    }
    void run(() => onCreateAndAssign(name));
  };

  return (
    <div className="expense-folder-select">
      <button
        type="button"
        className="expense-folder-select__trigger neo-select"
        disabled={disabled || busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={selectedLabel}
        onClick={() => setOpen(true)}
      >
        <span className="expense-folder-select__trigger-label">{truncateFolderName(selectedLabel)}</span>
      </button>
      <Modal
        isOpen={open}
        onClose={closePicker}
        title="Choose folder"
        dismissOnOverlayClick={!busy}
      >
        <div className="folder-picker">
          <div className="folder-picker__list" role="listbox" aria-label="Folders">
            <button
              type="button"
              className={`folder-picker__option${value == null ? ' folder-picker__option--selected' : ''}`}
              role="option"
              aria-selected={value == null}
              disabled={busy}
              onClick={() => handlePick('')}
            >
              <AppIcon name="folder" size={16} />
              No folder
            </button>
            {folders.map((folder) => {
              const isSelected = folder.id === value;
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`folder-picker__option${isSelected ? ' folder-picker__option--selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  disabled={busy}
                  title={folder.name}
                  onClick={() => handlePick(String(folder.id))}
                >
                  <AppIcon name="folder" size={16} />
                  {folder.name}
                </button>
              );
            })}
          </div>
          <div className="folder-picker__create">
            <label className="neo-label" htmlFor={newNameId}>New folder</label>
            <div className="folder-picker__create-row">
              <input
                id={newNameId}
                type="text"
                className="neo-input"
                maxLength={60}
                placeholder="Folder name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreate();
                  }
                }}
                disabled={disabled || busy}
              />
              <button className="neo-btn neo-btn--primary neo-btn--sm" type="button" onClick={handleCreate} disabled={disabled || busy}>
                Add
              </button>
            </div>
          </div>
          {error && <p className="expense-folder-select__error">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
