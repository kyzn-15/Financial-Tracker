import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import AppIcon from './AppIcon';
import OptionSelect from './OptionSelect';
import type { Category, RecurrenceFrequency } from '../types';
import { orderCategoriesByUse, useCategoryAutosort } from '../utils/categoryOrder';
import { getErrorMessage } from '../utils/errors';

interface CategoryManagerProps {
  categories: Category[];
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<Category[]>;
  onAdd: (name: string) => Promise<Category[]>;
  onRename: (id: number, name: string) => Promise<Category[]>;
  onRemove: (id: number) => Promise<Category[]>;
  onReorder: (ids: number[]) => Promise<Category[]>;
  onUpdateAutomation: (id: number, enabled: boolean, frequency: RecurrenceFrequency) => Promise<Category[]>;
}

export default function CategoryManager({
  categories,
  loading,
  error,
  onRetry,
  onAdd,
  onRename,
  onRemove,
  onReorder,
  onUpdateAutomation,
}: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [autosort, setAutosort] = useCategoryAutosort();
  const orderedCategories = useMemo(
    () => (autosort ? orderCategoriesByUse(categories) : categories),
    [autosort, categories],
  );

  useEffect(() => {
    onRetry().catch(() => {});
  }, [onRetry]);

  const runAction = async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setIsSaving(true);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not update categories.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setMessage('Enter a category name.');
      return;
    }
    const saved = await runAction(() => onAdd(name), `Added “${name}”.`);
    if (saved) setNewName('');
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setConfirmingRemovalId(null);
    setMessage('');
  };

  const handleRename = async (category: Category) => {
    const name = editingName.trim();
    if (!name) {
      setMessage('Category name cannot be empty.');
      return;
    }
    const saved = await runAction(() => onRename(category.id, name), `Renamed “${category.name}” to “${name}”.`);
    if (saved) setEditingId(null);
  };

  const handleRemove = async (category: Category) => {
    if (confirmingRemovalId !== category.id) {
      setConfirmingRemovalId(category.id);
      setEditingId(null);
      setMessage(`Select remove again to confirm “${category.name}”. Historical expenses will be preserved and its recurring payments will be cancelled.`);
      return;
    }

    const saved = await runAction(() => onRemove(category.id), `Removed “${category.name}” from category selections.`);
    if (saved) setConfirmingRemovalId(null);
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    if (autosort) return;
    const destination = index + direction;
    if (destination < 0 || destination >= orderedCategories.length) return;
    const reordered = [...orderedCategories];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    await runAction(() => onReorder(reordered.map((category) => category.id)), 'Category order updated.');
  };

  const updateAutomation = async (category: Category, enabled: boolean, frequency: RecurrenceFrequency = category.automation_frequency) => {
    await runAction(
      () => onUpdateAutomation(category.id, enabled, frequency),
      `${category.name} defaults to ${enabled ? `automated ${frequency} input` : 'manual input'}.`
    );
  };

  return (
    <section className="category-manager neo-card" aria-labelledby="category-manager-title">
      <div className="settings-section-heading">
        <div>
          <h3 id="category-manager-title">Expense Categories</h3>
          <p>Set the default for future expense entries. Autosort keeps this list and the add-expense categories ordered by how many expenses use them, most used first. Turn it off to arrange them with the arrows. Every automated payment can still be disabled individually.</p>
        </div>
        <label className="automation-switch automation-switch--labelled category-manager__autosort">
          <input
            type="checkbox"
            checked={autosort}
            onChange={(event) => setAutosort(event.target.checked)}
            aria-label="Autosort categories by how often they are used"
          />
          <span aria-hidden="true" />
          <strong>{autosort ? 'Autosort on' : 'Autosort off'}</strong>
        </label>
      </div>

      <form className="category-manager__add" onSubmit={handleAdd}>
        <label className="neo-label" htmlFor="new-category-name">New category</label>
        <div className="category-manager__add-row">
          <input
            id="new-category-name"
            className="neo-input"
            type="text"
            maxLength={60}
            value={newName}
            placeholder="e.g. Travel"
            onChange={(event) => setNewName(event.target.value)}
            disabled={isSaving}
          />
          <button className="neo-btn neo-btn--primary" type="submit" disabled={isSaving}>Add</button>
        </div>
      </form>

      {loading && categories.length === 0 ? (
        <p className="category-manager__status">Loading categories...</p>
      ) : (
        <div className="category-manager__list">
          {orderedCategories.map((category, index) => (
            <div className="category-manager__item" key={category.id}>
              <div className="category-manager__order" aria-label={`Reorder ${category.name}`}>
                <button type="button" onClick={() => moveCategory(index, -1)} disabled={isSaving || autosort || index === 0} aria-label={`Move ${category.name} up`} title={autosort ? 'Turn autosort off to reorder by hand' : undefined}><AppIcon name="arrow-up" size={15} /></button>
                <button type="button" onClick={() => moveCategory(index, 1)} disabled={isSaving || autosort || index === orderedCategories.length - 1} aria-label={`Move ${category.name} down`} title={autosort ? 'Turn autosort off to reorder by hand' : undefined}><AppIcon name="arrow-down" size={15} /></button>
              </div>

              {editingId === category.id ? (
                <input
                  className="neo-input category-manager__edit-input"
                  type="text"
                  maxLength={60}
                  value={editingName}
                  aria-label={`New name for ${category.name}`}
                  onChange={(event) => setEditingName(event.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              ) : (
                <div className="category-manager__name">
                  <strong>{category.name}</strong>
                  <span>{category.usage_count} {category.usage_count === 1 ? 'expense' : 'expenses'}</span>
                </div>
              )}

              <div className="category-manager__automation">
                <label className="automation-switch automation-switch--labelled">
                  <input type="checkbox" checked={category.automation_enabled} onChange={(event) => updateAutomation(category, event.target.checked)} disabled={isSaving} />
                  <span aria-hidden="true" />
                  <strong>{category.automation_enabled ? 'Automated' : 'Manual'}</strong>
                </label>
                <OptionSelect
                  className="category-manager__frequency"
                  dialogTitle={`Repeat ${category.name}`}
                  ariaLabel={`Default frequency for ${category.name}`}
                  value={category.automation_frequency}
                  onChange={(value) => updateAutomation(category, true, value === 'daily' || value === 'weekly' ? value : 'monthly')}
                  disabled={isSaving || !category.automation_enabled}
                  options={[
                    { value: 'daily', label: 'Every day' },
                    { value: 'weekly', label: 'Every week' },
                    { value: 'monthly', label: 'Every month' },
                  ]}
                />
              </div>

              <div className="category-manager__actions">
                {editingId === category.id ? (
                  <>
                    <button className="neo-btn neo-btn--primary neo-btn--sm" type="button" onClick={() => handleRename(category)} disabled={isSaving}>Save</button>
                    <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => setEditingId(null)} disabled={isSaving}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => startEditing(category)} disabled={isSaving}>Edit</button>
                    <button className="neo-btn neo-btn--danger neo-btn--sm" type="button" onClick={() => handleRemove(category)} disabled={isSaving}>
                      {confirmingRemovalId === category.id ? 'Confirm remove' : 'Remove'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(message || error) && (
        <div className="category-manager__feedback" role="status" aria-live="polite">
          <p className="category-manager__status">{message || error}</p>
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
