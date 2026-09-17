import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import AppIcon from './AppIcon';
import type { Category, Currency, ExchangeRate, Expense, ExpenseFolder, ExpenseInput, KursQuote, RecurrenceFrequency } from '../types';
import { formatKursInput, invertKursQuote } from '../utils/currency';
import { getErrorMessage } from '../utils/errors';
import { usePrivacyMode } from '../hooks/usePrivacyMode';

interface ExpenseFormProps {
  categories?: Category[];
  folders?: ExpenseFolder[];
  exchangeRate?: ExchangeRate | null;
  onCreateFolder?: (name: string) => Promise<ExpenseFolder>;
  onSubmit: (data: ExpenseInput) => Promise<unknown>;
  initialData?: Expense;
  submitText?: string;
  isCancelable?: boolean;
  onCancel?: () => void;
}

export default function ExpenseForm({
  categories = [],
  folders = [],
  exchangeRate = null,
  onCreateFolder,
  onSubmit,
  initialData,
  submitText = 'Save Expense',
  isCancelable,
  onCancel,
}: ExpenseFormProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('MYR');
  const [customDateTime, setCustomDateTime] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [customKurs, setCustomKurs] = useState('');
  const [kursQuote, setKursQuote] = useState<KursQuote>('MYR_IDR');
  const [folderId, setFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  const liveKurs = exchangeRate?.myrToIdr;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setCategory(initialData.category || '');
      const origCur = initialData.original_currency || 'MYR';
      setCurrency(origCur);
      setPrice(String(origCur === 'MYR' ? initialData.price_myr : initialData.price_idr));

      if (initialData.timestamp) {
        const formattedTs = initialData.timestamp.slice(0, 16);
        setCustomDateTime(formattedTs);
        setUseCurrentTime(false);
      } else {
        setUseCurrentTime(true);
      }

      const assignedFolder = initialData.folder_id != null ? String(initialData.folder_id) : '';
      setFolderId(assignedFolder);
      const storedKurs = Number(initialData.exchange_rate_used);
      if (Number.isFinite(storedKurs) && storedKurs > 0) {
        setCustomKurs(formatKursInput(storedKurs));
        setKursQuote('MYR_IDR');
      } else {
        setCustomKurs('');
        setKursQuote('MYR_IDR');
      }
      setRecurrenceEnabled(false);
      setRecurrenceFrequency('monthly');
      setShowAdditionalDetails(false);
    } else {
      setName('');
      setCategory('');
      setPrice('');
      setCurrency('MYR');
      setCustomDateTime('');
      setUseCurrentTime(true);
      setRecurrenceEnabled(false);
      setRecurrenceFrequency('monthly');
      setCustomKurs('');
      setKursQuote('MYR_IDR');
      setFolderId('');
      setNewFolderName('');
      setShowAdditionalDetails(false);
    }
    setValidationError('');
  }, [initialData]);

  useEffect(() => {
    if (!initialData && !category && categories.length > 0) {
      const firstCategory = categories[0];
      setCategory(firstCategory.name);
      setRecurrenceEnabled(firstCategory.automation_enabled);
      setRecurrenceFrequency(firstCategory.automation_frequency || 'monthly');
    }
  }, [categories, category, initialData]);

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    if (initialData) return;
    const categorySettings = categories.find((item) => item.name === nextCategory);
    setRecurrenceEnabled(Boolean(categorySettings?.automation_enabled));
    setRecurrenceFrequency(categorySettings?.automation_frequency || 'monthly');
  };

  const handleSwapKursQuote = () => {
    const nextQuote: KursQuote = kursQuote === 'MYR_IDR' ? 'IDR_MYR' : 'MYR_IDR';
    if (customKurs.trim() !== '') {
      const value = Number(customKurs);
      if (!Number.isFinite(value) || value <= 0) {
        setValidationError('Enter a valid custom kurs before swapping the quote.');
        return;
      }
      setCustomKurs(formatKursInput(invertKursQuote(value)));
    }
    setKursQuote(nextQuote);
    setValidationError('');
  };

  const handleCreateFolder = async () => {
    const nameValue = newFolderName.trim().replace(/\s+/g, ' ');
    if (!nameValue || nameValue.length > 60) {
      setValidationError('Folder name must be between 1 and 60 characters.');
      return;
    }
    if (!onCreateFolder) return;
    setCreatingFolder(true);
    try {
      const created = await onCreateFolder(nameValue);
      setFolderId(String(created.id));
      setNewFolderName('');
      setValidationError('');
    } catch (err) {
      setValidationError(getErrorMessage(err, 'Failed to create folder.'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
    let resolvedCustomKurs: number | undefined;
    let resolvedQuote: KursQuote | undefined;
    if (customKurs.trim() !== '') {
      const kurs = Number(customKurs);
      if (!Number.isFinite(kurs) || kurs <= 0) {
        setValidationError('Custom kurs must be a positive number.');
        return;
      }
      resolvedCustomKurs = kurs;
      resolvedQuote = kursQuote;
    }

    setSubmitting(true);
    try {
      let formattedTimestamp = '';
      if (!useCurrentTime && customDateTime) {
        formattedTimestamp = customDateTime + '+08:00';
      }

      const data: ExpenseInput = {
        name: name.trim(),
        category,
        price: Number(price),
        currency,
        timestamp: formattedTimestamp,
        folderId: folderId === '' ? null : Number(folderId),
      };
      if (resolvedCustomKurs != null && resolvedQuote) {
        data.customKurs = resolvedCustomKurs;
        data.customKursQuote = resolvedQuote;
      } else if (initialData) {
        data.customKurs = null;
      }
      if (!initialData) {
        data.recurrence = recurrenceEnabled
          ? { enabled: true, frequency: recurrenceFrequency }
          : { enabled: false };
      }
      await onSubmit(data);

      if (!initialData) {
        setName('');
        setPrice('');
        setUseCurrentTime(true);
        setCustomDateTime('');
        setCustomKurs('');
        setKursQuote('MYR_IDR');
        setFolderId('');
        setNewFolderName('');
        setShowAdditionalDetails(false);
      }
    } catch (err) {
      setValidationError(getErrorMessage(err, 'Failed to submit expense.'));
    } finally {
      setSubmitting(false);
    }
  };

  const kursPrefix = kursQuote === 'IDR_MYR' ? '1 IDR =' : '1 MYR =';
  const kursSuffix = kursQuote === 'IDR_MYR' ? 'MYR' : 'IDR';

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      {validationError && (
        <div className="expense-form__error">
          <AppIcon name="alert" size={17} /> {validationError}
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
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
          >
            <option value="" disabled>Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="neo-input-group">
          <span className="neo-label">Currency</span>
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
          type={isPrivacyMode ? 'password' : 'number'}
          inputMode="decimal"
          step="0.01"
          className="neo-input"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      {!initialData && (
        <div className="expense-recurrence">
          <div className="expense-recurrence__heading">
            <div>
              <strong>Automated input</strong>
            </div>
            <label className="automation-switch">
              <input
                type="checkbox"
                checked={recurrenceEnabled}
                onChange={(event) => setRecurrenceEnabled(event.target.checked)}
              />
              <span aria-hidden="true" />
              <span className="sr-only">Enable automated input</span>
            </label>
          </div>
          {recurrenceEnabled && (
            <div className="neo-input-group">
              <label className="neo-label" htmlFor="expense-recurrence-frequency">Repeat every</label>
              <select
                id="expense-recurrence-frequency"
                className="neo-select"
                value={recurrenceFrequency}
                onChange={(event) => setRecurrenceFrequency(event.target.value === 'daily' || event.target.value === 'weekly' ? event.target.value : 'monthly')}
              >
                <option value="daily">Day</option>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
              </select>
              <p className="expense-recurrence__hint">This expense is the first occurrence. The next one follows after one interval.</p>
            </div>
          )}
        </div>
      )}

      {initialData?.recurring_rule_id && (
        <p className="expense-recurrence__notice"><AppIcon name="refresh" size={15} /> This edit affects this occurrence only. Change future payments in Settings.</p>
      )}

      <div className="neo-input-group">
        <span className="neo-label">Date / Time</span>
        <div className="expense-form__datetime">
          <label className="expense-form__check">
            <input
              type="checkbox"
              checked={useCurrentTime}
              onChange={(e) => setUseCurrentTime(e.target.checked)}
            />
            Use current time (UTC+8)
          </label>

          {!useCurrentTime && (
            <input
              id="expense-datetime"
              type="datetime-local"
              className="neo-input"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              required={!useCurrentTime}
            />
          )}
        </div>
      </div>

      <div className="expense-form__details">
        <button
          type="button"
          className="expense-form__details-toggle"
          onClick={() => setShowAdditionalDetails((open) => !open)}
          aria-expanded={showAdditionalDetails}
        >
          <strong>Additional Details</strong>
          <span className={`expense-form__details-caret ${showAdditionalDetails ? 'expense-form__details-caret--open' : ''}`}>
            <AppIcon name="chevron-right" size={16} />
          </span>
        </button>
        {showAdditionalDetails && (
          <div className="expense-form__details-body">
            <p className="expense-form__hint">Optional exchange-rate override and organization.</p>

            <div className="neo-input-group">
              <label className="neo-label" htmlFor="expense-custom-kurs">
                Custom kurs ({kursQuote === 'IDR_MYR' ? '1 IDR = Y MYR' : '1 MYR = X IDR'})
              </label>
              <div className="expense-form__kurs">
                <span className="expense-form__kurs-prefix">{kursPrefix}</span>
                <input
                  id="expense-custom-kurs"
                  type={isPrivacyMode ? 'password' : 'number'}
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className="neo-input"
                  placeholder={kursQuote === 'IDR_MYR' ? 'e.g. 0.00023' : (liveKurs ? String(liveKurs) : 'e.g. 3750')}
                  value={customKurs}
                  onChange={(e) => setCustomKurs(e.target.value)}
                />
                <span className="expense-form__kurs-suffix">{kursSuffix}</span>
                <button
                  type="button"
                  className="neo-btn neo-btn--secondary expense-form__swap"
                  onClick={handleSwapKursQuote}
                  title="Swap kurs quote between 1 MYR = X IDR and 1 IDR = Y MYR"
                  aria-label="Swap kurs quote direction"
                >
                  <AppIcon name="swap" size={16} />
                  Swap
                </button>
              </div>
              <p className="expense-form__hint">
                {kursQuote === 'IDR_MYR'
                  ? 'Enter how many MYR one IDR is worth. Saved as 1 MYR = 1 / Y IDR. Clear the field to use the live rate.'
                  : 'Leave empty to use the live rate, or enter how many IDR one MYR is worth.'}
              </p>
            </div>

            <div className="neo-input-group">
              <label className="neo-label" htmlFor="expense-folder">Folder</label>
              <select
                id="expense-folder"
                className="neo-select"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              {onCreateFolder && (
                <div className="expense-form__folder-create">
                  <input
                    type="text"
                    className="neo-input"
                    maxLength={60}
                    placeholder="New folder, e.g. malaysian traveling trip"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    aria-label="New folder name"
                  />
                  <button
                    type="button"
                    className="neo-btn neo-btn--secondary expense-form__folder-add"
                    onClick={handleCreateFolder}
                    disabled={creatingFolder}
                  >
                    <AppIcon name="plus" size={15} /> Add
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
