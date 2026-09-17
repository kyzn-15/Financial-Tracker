import { useState } from 'react';
import type { FormEvent } from 'react';
import FolderSelect from './FolderSelect';
import type { Expense, ExpenseFolder } from '../types';
import { getErrorMessage } from '../utils/errors';

interface FolderManagerProps {
  folders: ExpenseFolder[];
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<unknown>;
  onAdd: (name: string) => Promise<ExpenseFolder>;
  onRename: (id: number, name: string) => Promise<ExpenseFolder[]>;
  onRemove: (id: number) => Promise<ExpenseFolder[]>;
  onAssign: (expenseId: number, folderId: number | null) => Promise<unknown>;
  onCreateAndAssign: (expenseId: number, name: string) => Promise<unknown>;
}

export default function FolderManager({
  folders,
  expenses,
  loading,
  error,
  onRetry,
  onAdd,
  onRename,
  onRemove,
  onAssign,
  onCreateAndAssign,
}: FolderManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const ungrouped = expenses.filter((expense) => expense.folder_id == null);

  const runAction = async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setIsSaving(true);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not update folders.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setMessage('Enter a folder name.');
      return;
    }
    const saved = await runAction(() => onAdd(name), `Added “${name}”.`);
    if (saved) setNewName('');
  };

  const startEditing = (folder: ExpenseFolder) => {
    setEditingId(folder.id);
    setEditingName(folder.name);
    setConfirmingRemovalId(null);
    setMessage('');
  };

  const handleRename = async (folder: ExpenseFolder) => {
    const name = editingName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setMessage('Folder name cannot be empty.');
      return;
    }
    const saved = await runAction(() => onRename(folder.id, name), `Renamed “${folder.name}” to “${name}”.`);
    if (saved) setEditingId(null);
  };

  const handleRemove = async (folder: ExpenseFolder) => {
    if (confirmingRemovalId !== folder.id) {
      setConfirmingRemovalId(folder.id);
      setEditingId(null);
      setMessage(`Select delete again to confirm “${folder.name}”. Expenses in this folder will move to the Recycle Bin.`);
      return;
    }

    const saved = await runAction(() => onRemove(folder.id), `Deleted “${folder.name}” and moved its expenses to the Recycle Bin.`);
    if (saved) setConfirmingRemovalId(null);
  };

  const renderMembers = (members: Expense[], emptyLabel: string) => (
    <div className="folder-manager__members">
      {members.length === 0 ? (
        <p className="folder-manager__empty">{emptyLabel}</p>
      ) : members.map((expense) => (
        <div className="folder-manager__member" key={expense.id}>
          <span className="folder-manager__member-name">{expense.name}</span>
          <FolderSelect
            folders={folders}
            value={expense.folder_id}
            disabled={isSaving}
            ariaLabel={`Folder for ${expense.name}`}
            onAssign={(folderId) => onAssign(expense.id, folderId)}
            onCreateAndAssign={(name) => onCreateAndAssign(expense.id, name)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <section className="folder-manager neo-card" aria-labelledby="folder-manager-title">
      <div className="settings-section-heading">
        <div>
          <h3 id="folder-manager-title">Manage Folders</h3>
          <p>Rename folders, delete a folder and the expenses inside it, or move expenses between folders.</p>
        </div>
      </div>

      <form className="folder-manager__add" onSubmit={handleAdd}>
        <label className="neo-label" htmlFor="new-folder-name">New folder</label>
        <div className="folder-manager__add-row">
          <input
            id="new-folder-name"
            className="neo-input"
            type="text"
            maxLength={60}
            value={newName}
            placeholder="e.g. malaysian traveling trip"
            onChange={(event) => setNewName(event.target.value)}
            disabled={isSaving}
          />
          <button className="neo-btn neo-btn--primary" type="submit" disabled={isSaving}>Add</button>
        </div>
      </form>

      {loading ? (
        <p className="folder-manager__status">Loading folders...</p>
      ) : (
        <div className="folder-manager__list">
          <div className="folder-manager__item">
            <div className="folder-manager__header">
              <div className="folder-manager__name">
                <strong>Ungrouped</strong>
                <span>{ungrouped.length} {ungrouped.length === 1 ? 'expense' : 'expenses'}</span>
              </div>
            </div>
            {renderMembers(ungrouped, 'No ungrouped expenses.')}
          </div>

          {folders.map((folder) => {
            const members = expenses.filter((expense) => Number(expense.folder_id) === folder.id);
            return (
              <div className="folder-manager__item" key={folder.id}>
                <div className="folder-manager__header">
                  {editingId === folder.id ? (
                    <input
                      className="neo-input folder-manager__edit-input"
                      type="text"
                      maxLength={60}
                      value={editingName}
                      aria-label={`New name for ${folder.name}`}
                      onChange={(event) => setEditingName(event.target.value)}
                      disabled={isSaving}
                      autoFocus
                    />
                  ) : (
                    <div className="folder-manager__name">
                      <strong>{folder.name}</strong>
                      <span>{members.length} {members.length === 1 ? 'expense' : 'expenses'}</span>
                    </div>
                  )}
                  <div className="folder-manager__actions">
                    {editingId === folder.id ? (
                      <>
                        <button className="neo-btn neo-btn--primary neo-btn--sm" type="button" onClick={() => handleRename(folder)} disabled={isSaving}>Save</button>
                        <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => setEditingId(null)} disabled={isSaving}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => startEditing(folder)} disabled={isSaving}>Edit</button>
                        <button className="neo-btn neo-btn--danger neo-btn--sm" type="button" onClick={() => handleRemove(folder)} disabled={isSaving}>
                          {confirmingRemovalId === folder.id ? 'Confirm delete' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {renderMembers(members, 'No expenses in this folder.')}
              </div>
            );
          })}
        </div>
      )}

      {(message || error) && (
        <div className="folder-manager__feedback" role="status" aria-live="polite">
          <p className="folder-manager__status">{message || error}</p>
          {error && (
            <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => onRetry().catch(() => {})} disabled={loading}>
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
