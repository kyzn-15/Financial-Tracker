import { useState } from 'react';
import type { FormEvent } from 'react';
import AppIcon from './AppIcon';
import { formatDateTime } from '../utils/formatters';
import type { Category, Currency, RecurrenceFrequency, RecurringExpense, RecurringExpenseStore } from '../types';
import { getErrorMessage } from '../utils/errors';

function getFutureNextRun(frequency: RecurrenceFrequency): string {
  const shiftedNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();
  const hour = shiftedNow.getUTCHours();
  const minute = shiftedNow.getUTCMinutes();
  const second = shiftedNow.getUTCSeconds();
  let next;

  if (frequency === 'daily') next = new Date(Date.UTC(year, month, day + 1, hour, minute, second));
  else if (frequency === 'weekly') next = new Date(Date.UTC(year, month, day + 7, hour, minute, second));
  else {
    const targetMonth = new Date(Date.UTC(year, month + 1, 1));
    const targetYear = targetMonth.getUTCFullYear();
    const targetMonthIndex = targetMonth.getUTCMonth();
    const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
    next = new Date(Date.UTC(targetYear, targetMonthIndex, Math.min(day, lastDay), hour, minute, second));
  }

  return next.toISOString().slice(0, 19) + '+08:00';
}

interface RecurringForm {
  name: string;
  category: string;
  price: string;
  currency: Currency;
  frequency: RecurrenceFrequency;
  next_run_at: string;
  status: 'active' | 'paused';
}

function createForm(rule: RecurringExpense): RecurringForm {
  return {
    name: rule.name,
    category: rule.category,
    price: String(rule.price),
    currency: rule.currency,
    frequency: rule.frequency,
    next_run_at: rule.next_run_at.slice(0, 16),
    status: rule.status === 'paused' ? 'paused' : 'active',
  };
}

interface RecurringPaymentsManagerProps {
  store: RecurringExpenseStore;
  categories: Category[];
}

export default function RecurringPaymentsManager({ store, categories }: RecurringPaymentsManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RecurringForm | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const startEditing = (rule: RecurringExpense) => {
    setEditingId(rule.id);
    setForm(createForm(rule));
    setConfirmingCancelId(null);
    setMessage('');
  };

  const updateForm = (changes: Partial<RecurringForm>) => {
    setForm((current) => current ? { ...current, ...changes } : current);
  };

  const saveRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || editingId == null) return;
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0 || !form.next_run_at) {
      setMessage('Enter a valid payment name, amount, and next payment date.');
      return;
    }
    setSavingId(editingId);
    setMessage('');
    try {
      await store.update(editingId, {
        ...form,
        name: form.name.trim(),
        price,
        next_run_at: `${form.next_run_at}:00+08:00`,
      });
      setEditingId(null);
      setForm(null);
      setMessage('Recurring payment updated. Changes apply to future occurrences.');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not update recurring payment.'));
    } finally {
      setSavingId(null);
    }
  };

  const togglePause = async (rule: RecurringExpense) => {
    setSavingId(rule.id);
    setMessage('');
    const isResuming = rule.status === 'paused';
    const nextRunAt = isResuming && Date.parse(rule.next_run_at) <= Date.now()
      ? getFutureNextRun(rule.frequency)
      : rule.next_run_at;
    try {
      await store.update(rule.id, {
        name: rule.name,
        category: rule.category,
        price: rule.price,
        currency: rule.currency,
        frequency: rule.frequency,
        next_run_at: nextRunAt,
        status: isResuming ? 'active' : 'paused',
      });
      setMessage(isResuming ? 'Recurring payment resumed.' : 'Recurring payment paused.');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not change recurring payment status.'));
    } finally {
      setSavingId(null);
    }
  };

  const cancelRule = async (rule: RecurringExpense) => {
    if (confirmingCancelId !== rule.id) {
      setConfirmingCancelId(rule.id);
      setMessage(`Select cancel again to stop future “${rule.name}” payments.`);
      return;
    }
    setSavingId(rule.id);
    try {
      await store.cancel(rule.id);
      setConfirmingCancelId(null);
      setMessage(`Cancelled future “${rule.name}” payments.`);
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not cancel recurring payment.'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="recurring-manager clay-card" aria-labelledby="recurring-manager-title">
      <div className="settings-section-heading">
        <div>
          <h3 id="recurring-manager-title">Recurring Payments</h3>
          <p>Manage future automated expenses. History edits always affect one occurrence only.</p>
        </div>
      </div>

      {store.loading && store.rules.length === 0 ? (
        <p className="category-manager__status">Loading recurring payments...</p>
      ) : store.rules.length === 0 ? (
        <div className="recurring-manager__empty">
          <AppIcon name="refresh" size={24} />
          <p>No recurring payments yet. Enable automated input when adding an expense.</p>
        </div>
      ) : (
        <div className="recurring-manager__list">
          {store.rules.map((rule) => editingId === rule.id && form ? (
            <form className="recurring-manager__edit" key={rule.id} onSubmit={saveRule}>
              <div className="recurring-manager__edit-grid">
                <label className="clay-input-group"><span className="clay-label">Payment</span><input className="clay-input" value={form.name} maxLength={160} onChange={(event) => updateForm({ name: event.target.value })} /></label>
                <label className="clay-input-group"><span className="clay-label">Category</span><select className="clay-select" value={form.category} onChange={(event) => updateForm({ category: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
                <label className="clay-input-group"><span className="clay-label">Amount</span><input className="clay-input" type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => updateForm({ price: event.target.value })} /></label>
                <label className="clay-input-group"><span className="clay-label">Currency</span><select className="clay-select" value={form.currency} onChange={(event) => updateForm({ currency: event.target.value === 'IDR' ? 'IDR' : 'MYR' })}><option value="MYR">MYR</option><option value="IDR">IDR</option></select></label>
                <label className="clay-input-group"><span className="clay-label">Repeat</span><select className="clay-select" value={form.frequency} onChange={(event) => updateForm({ frequency: event.target.value === 'daily' || event.target.value === 'weekly' ? event.target.value : 'monthly' })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                <label className="clay-input-group"><span className="clay-label">Next payment (UTC+8)</span><input className="clay-input" type="datetime-local" value={form.next_run_at} onChange={(event) => updateForm({ next_run_at: event.target.value })} /></label>
              </div>
              <div className="category-manager__actions"><button className="clay-btn clay-btn--primary clay-btn--sm" disabled={savingId === rule.id}>Save</button><button className="clay-btn clay-btn--secondary clay-btn--sm" type="button" onClick={() => setEditingId(null)} disabled={savingId === rule.id}>Cancel</button></div>
            </form>
          ) : (
            <article className="recurring-manager__item" key={rule.id}>
              <div className="recurring-manager__icon"><AppIcon name="refresh" size={18} /></div>
              <div className="recurring-manager__details">
                <div className="recurring-manager__title"><strong>{rule.name}</strong><span className={`recurring-status recurring-status--${rule.status}`}>{rule.status}</span></div>
                <p>{rule.currency} {Number(rule.price).toLocaleString('en', { maximumFractionDigits: 2 })} · {rule.category} · {rule.frequency}</p>
                <span>Next: {formatDateTime(rule.next_run_at)}</span>
              </div>
              <div className="category-manager__actions">
                <button className="clay-btn clay-btn--secondary clay-btn--sm" type="button" onClick={() => startEditing(rule)} disabled={savingId === rule.id}>Edit</button>
                <button className="clay-btn clay-btn--secondary clay-btn--sm" type="button" onClick={() => togglePause(rule)} disabled={savingId === rule.id}>{rule.status === 'paused' ? 'Resume' : 'Pause'}</button>
                <button className="clay-btn clay-btn--danger clay-btn--sm" type="button" onClick={() => cancelRule(rule)} disabled={savingId === rule.id}>{confirmingCancelId === rule.id ? 'Confirm cancel' : 'Cancel'}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(message || store.error) && <div className="category-manager__feedback" role="status" aria-live="polite"><p className="category-manager__status">{message || store.error}</p>{store.error && <button className="clay-btn clay-btn--secondary clay-btn--sm" type="button" onClick={() => store.refresh().catch(() => {})}>Retry</button>}</div>}
    </section>
  );
}
