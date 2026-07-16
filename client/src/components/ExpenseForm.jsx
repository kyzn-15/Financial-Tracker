import React, { useState, useEffect } from 'react';

export default function ExpenseForm({ categories = [], onSubmit, initialData, submitText = 'Save Expense', isCancelable, onCancel }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [customDateTime, setCustomDateTime] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setCategory(initialData.category || '');
      // When editing, if price is set, use original currency value
      const origCur = initialData.original_currency || 'MYR';
      setCurrency(origCur);
      setPrice(origCur === 'MYR' ? initialData.price_myr : initialData.price_idr);
      
      if (initialData.timestamp) {
        // Strip timezone offset (+08:00) so it fits in datetime-local value
        // e.g. "2026-06-27T18:03:00+08:00" -> "2026-06-27T18:03:00"
        const formattedTs = initialData.timestamp.slice(0, 16);
        setCustomDateTime(formattedTs);
        setUseCurrentTime(false);
      } else {
        setUseCurrentTime(true);
      }
    } else {
      // Defaults
      setName('');
      setCategory('');
      setPrice('');
      setCurrency('MYR');
      setCustomDateTime('');
      setUseCurrentTime(true);
    }
    setValidationError('');
  }, [initialData]);

  useEffect(() => {
    if (!initialData && !category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories, category, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Expense name is required.');
      return;
    }
    if (!category) {
      setValidationError('Category is required.');
      return;
    }
    if (price === '' || isNaN(Number(price)) || Number(price) <= 0) {
      setValidationError('Price must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      let formattedTimestamp = '';
      if (!useCurrentTime && customDateTime) {
        // Make sure it has +08:00
        formattedTimestamp = customDateTime + '+08:00';
      }

      await onSubmit({
        name: name.trim(),
        category,
        price: Number(price),
        currency,
        timestamp: formattedTimestamp,
      });

      // Clear form if not editing
      if (!initialData) {
        setName('');
        setPrice('');
        setUseCurrentTime(true);
        setCustomDateTime('');
      }
    } catch (err) {
      setValidationError(err.message || 'Failed to submit expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      {validationError && (
        <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
          ⚠️ {validationError}
        </div>
      )}

      <div className="neo-input-group">
        <label className="neo-label" htmlFor="expense-name">Expense Name</label>
        <input
          id="expense-name"
          type="text"
          className="neo-input"
          placeholder="e.g. Nasi Goreng"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="expense-form__row">
        <div className="neo-input-group">
          <label className="neo-label" htmlFor="expense-category">Category</label>
          <select
            id="expense-category"
            className="neo-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="" disabled>Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="neo-input-group">
          <label className="neo-label">Currency</label>
          <div className="currency-toggle">
            <button
              type="button"
              className={`currency-toggle__btn ${currency === 'MYR' ? 'currency-toggle__btn--active' : ''}`}
              onClick={() => setCurrency('MYR')}
            >
              MYR
            </button>
            <button
              type="button"
              className={`currency-toggle__btn ${currency === 'IDR' ? 'currency-toggle__btn--active' : ''}`}
              onClick={() => setCurrency('IDR')}
            >
              IDR
            </button>
          </div>
        </div>
      </div>

      <div className="neo-input-group">
        <label className="neo-label" htmlFor="expense-price">Price ({currency})</label>
        <input
          id="expense-price"
          type="number"
          step="0.01"
          className="neo-input"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      <div className="neo-input-group">
        <label className="neo-label">Date / Time</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            <input
              type="checkbox"
              checked={useCurrentTime}
              onChange={(e) => setUseCurrentTime(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Use current time (UTC+8)
          </label>

          {!useCurrentTime && (
            <input
              type="datetime-local"
              className="neo-input"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              required={!useCurrentTime}
            />
          )}
        </div>
      </div>

      <div className="expense-form__actions">
        <button
          type="submit"
          className="neo-btn neo-btn--primary neo-btn--full"
          disabled={submitting}
        >
          {submitting ? 'Processing...' : submitText}
        </button>

        {isCancelable && onCancel && (
          <button
            type="button"
            className="neo-btn neo-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
