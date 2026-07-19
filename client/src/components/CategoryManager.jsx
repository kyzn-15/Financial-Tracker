import React, { useState } from 'react';
import AppIcon from './AppIcon';

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
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingRemovalId, setConfirmingRemovalId] = useState(null);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const runAction = async (action, successMessage) => {
    setIsSaving(true);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (err) {
      setMessage(err.message || 'Could not update categories.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setMessage('Enter a category name.');
      return;
    }
    const saved = await runAction(() => onAdd(name), `Added “${name}”.`);
    if (saved) setNewName('');
  };

  const startEditing = (category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setConfirmingRemovalId(null);
    setMessage('');
  };

  const handleRename = async (category) => {
    const name = editingName.trim();
    if (!name) {
      setMessage('Category name cannot be empty.');
      return;
    }
    const saved = await runAction(() => onRename(category.id, name), `Renamed “${category.name}” to “${name}”.`);
    if (saved) setEditingId(null);
  };

  const handleRemove = async (category) => {
    if (confirmingRemovalId !== category.id) {
      setConfirmingRemovalId(category.id);
      setEditingId(null);
      setMessage(`Select remove again to confirm “${category.name}”. Historical expenses will be preserved and its recurring payments will be cancelled.`);
      return;
    }

    const saved = await runAction(() => onRemove(category.id), `Removed “${category.name}” from category selections.`);
    if (saved) setConfirmingRemovalId(null);
  };

  const moveCategory = async (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    await runAction(() => onReorder(reordered.map((category) => category.id)), 'Category order updated.');
  };

  const updateAutomation = async (category, enabled, frequency = category.automation_frequency) => {
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
          <p>Set the default for future expense entries. Every automated payment can still be disabled individually.</p>
        </div>
      </div>

      <form className="category-manager__add" onSubmit={handleAdd}>
        <label className="neo-label" htmlFor="new-category-name">New category</label>
        <div className="category-manager__add-row">
          <input
            id="new-category-name"
            className="neo-input"
            type="text"
            maxLength="60"
            value={newName}
            placeholder="e.g. Travel"
            onChange={(event) => setNewName(event.target.value)}
            disabled={isSaving}
          />
          <button className="neo-btn neo-btn--primary" type="submit" disabled={isSaving}>Add</button>
        </div>
      </form>

      {loading ? (
        <p className="category-manager__status">Loading categories...</p>
      ) : (
        <div className="category-manager__list">
          {categories.map((category, index) => (
            <div className="category-manager__item" key={category.id}>
              <div className="category-manager__order" aria-label={`Reorder ${category.name}`}>
                <button type="button" onClick={() => moveCategory(index, -1)} disabled={isSaving || index === 0} aria-label={`Move ${category.name} up`}><AppIcon name="arrow-up" size={15} /></button>
                <button type="button" onClick={() => moveCategory(index, 1)} disabled={isSaving || index === categories.length - 1} aria-label={`Move ${category.name} down`}><AppIcon name="arrow-down" size={15} /></button>
              </div>

              {editingId === category.id ? (
                <input
                  className="neo-input category-manager__edit-input"
                  type="text"
                  maxLength="60"
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
                <select className="neo-select category-manager__frequency" value={category.automation_frequency} onChange={(event) => updateAutomation(category, true, event.target.value)} disabled={isSaving || !category.automation_enabled} aria-label={`Default frequency for ${category.name}`}>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
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
