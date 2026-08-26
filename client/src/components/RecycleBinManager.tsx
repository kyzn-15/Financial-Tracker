import { useEffect, useState } from 'react';
import { formatCurrencyAmount, formatDate } from '../utils/formatters';
import { getCategoryIconName } from '../utils/categoryIcons';
import { getReceiptImageUrl } from '../services/api';
import AppIcon from './AppIcon';
import Modal from './Modal';
import type { Currency, ExchangeRate, RecycleBinStore } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysDeleted(deletedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(deletedAt).getTime()) / MS_PER_DAY));
}

function daysUntilDeletion(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / MS_PER_DAY));
}

function deletedLabel(deletedAt: string): string {
  const days = daysDeleted(deletedAt);
  return days === 0 ? 'Deleted today' : `Deleted ${days} day${days === 1 ? '' : 's'} ago`;
}

interface PurgeTarget {
  type: 'expense' | 'receipt';
  id: number;
  label: string;
}

interface RecycleBinManagerProps {
  store: RecycleBinStore;
  currency: Currency;
  exchangeRate: ExchangeRate | null;
  onNotify: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export default function RecycleBinManager({ store, currency, exchangeRate, onNotify }: RecycleBinManagerProps) {
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);
  const [isEmptyOpen, setIsEmptyOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);

  const load = store.load;
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  const expenses = store.contents?.expenses ?? [];
  const receipts = store.contents?.receipts ?? [];
  const retentionDays = store.contents?.retention_days ?? 7;
  const isEmpty = !store.loading && !store.error && expenses.length === 0 && receipts.length === 0;
  const busy = isPurging || isEmptying;

  const handleRestore = async (type: 'expense' | 'receipt', id: number, label: string) => {
    try {
      if (type === 'expense') await store.restoreExpense(id);
      else await store.restoreReceipt(id);
      onNotify(`Restored "${label}" from the Recycle Bin.`, 'success');
    } catch {
      onNotify(store.error || `Could not restore "${label}".`, 'error');
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setIsPurging(true);
    try {
      if (purgeTarget.type === 'expense') await store.purgeExpense(purgeTarget.id);
      else await store.purgeReceipt(purgeTarget.id);
      onNotify(`Permanently deleted "${purgeTarget.label}".`, 'success');
      setPurgeTarget(null);
    } catch {
      onNotify(store.error || 'Could not permanently delete the item.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const confirmEmpty = async () => {
    setIsEmptying(true);
    try {
      const result = await store.emptyBin();
      onNotify(`Recycle Bin emptied. ${result.expenses} expense(s) and ${result.receipts} receipt(s) permanently deleted.`, 'success');
      setIsEmptyOpen(false);
    } catch {
      onNotify(store.error || 'Could not empty the Recycle Bin.', 'error');
    } finally {
      setIsEmptying(false);
    }
  };

  const renderExpenseItem = (expense: (typeof expenses)[number]) => {
    const busyKey = store.busyId === `expense-${expense.id}`;
    return (
      <article key={`expense-${expense.id}`} className="recycle-item neo-card">
        <span className="recycle-item__icon">
          <AppIcon name={getCategoryIconName(expense.category)} size={18} />
        </span>
        <div className="recycle-item__content">
          <p className="recycle-item__title">{expense.name}</p>
          <p className="recycle-item__meta">
            {expense.category} · {formatCurrencyAmount(expense.price_myr, currency, myrToIdr)} · {formatDate(expense.timestamp)}
          </p>
          <p className="recycle-item__retention">
            {deletedLabel(expense.deleted_at)}
            {' · '}Permanently deleted in {daysUntilDeletion(expense.expires_at)} day{daysUntilDeletion(expense.expires_at) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="recycle-item__actions">
          <button
            type="button"
            className="neo-btn neo-btn--secondary neo-btn--sm"
            onClick={() => handleRestore('expense', expense.id, expense.name)}
            disabled={busy || busyKey}
          >
            <AppIcon name="rotate-ccw" size={14} /> Restore
          </button>
          <button
            type="button"
            className="neo-btn neo-btn--danger neo-btn--sm"
            onClick={() => setPurgeTarget({ type: 'expense', id: expense.id, label: expense.name })}
            disabled={busy || busyKey}
          >
            <AppIcon name="trash" size={14} /> Delete Permanently
          </button>
        </div>
      </article>
    );
  };

  const renderReceiptItem = (receipt: (typeof receipts)[number]) => {
    const busyKey = store.busyId === `receipt-${receipt.id}`;
    return (
      <article key={`receipt-${receipt.id}`} className="recycle-item neo-card">
        <span className="recycle-item__icon">
          {receipt.image_available ? (
            <img src={getReceiptImageUrl(receipt.id)} alt="" className="recycle-item__thumb" loading="lazy" />
          ) : (
            <AppIcon name="receipt" size={18} />
          )}
        </span>
        <div className="recycle-item__content">
          <p className="recycle-item__title">Receipt — {formatDate(receipt.uploaded_at)}</p>
          <p className="recycle-item__meta">
            Uploaded {formatDate(receipt.uploaded_at)}
            {!receipt.image_available && ' · Image file missing'}
          </p>          <p className="recycle-item__retention">
            {deletedLabel(receipt.deleted_at)}
            {' · '}Permanently deleted in {daysUntilDeletion(receipt.expires_at)} day{daysUntilDeletion(receipt.expires_at) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="recycle-item__actions">
          <button
            type="button"
            className="neo-btn neo-btn--secondary neo-btn--sm"
            onClick={() => handleRestore('receipt', receipt.id, 'receipt')}
            disabled={busy || busyKey}
          >
            <AppIcon name="rotate-ccw" size={14} /> Restore
          </button>
          <button
            type="button"
            className="neo-btn neo-btn--danger neo-btn--sm"
            onClick={() => setPurgeTarget({ type: 'receipt', id: receipt.id, label: `receipt from ${formatDate(receipt.uploaded_at)}` })}
            disabled={busy || busyKey}
          >
            <AppIcon name="trash" size={14} /> Delete Permanently
          </button>
        </div>
      </article>
    );
  };

  return (
    <section className="recycle-bin neo-card" aria-labelledby="recycle-bin-title">
      <div className="settings-section-heading">
        <div>
          <h3 id="recycle-bin-title">Recycle Bin</h3>
          <p>
            Deleted expenses and receipts are kept for {retentionDays} days, then permanently deleted automatically.
          </p>
        </div>
        <button
          className="neo-btn neo-btn--danger"
          type="button"
          onClick={() => setIsEmptyOpen(true)}
          disabled={busy || isEmpty}
        >
          Empty Recycle Bin
        </button>
      </div>

      {store.loading && !store.contents ? (
        <div className="loading-spinner">
          <div className="loading-spinner__circle" />
        </div>
      ) : store.error && !store.contents ? (
        <div className="recycle-bin__status recycle-bin__status--error">
          <AppIcon name="alert" size={16} /> {store.error}
          <button className="neo-btn neo-btn--secondary neo-btn--sm" type="button" onClick={() => store.load().catch(() => {})}>
            Retry
          </button>
        </div>
      ) : isEmpty ? (
        <div className="empty-state">
          <div className="empty-state__icon"><AppIcon name="trash" size={28} /></div>
          <p className="empty-state__text">Recycle Bin is empty</p>
          <p className="empty-state__subtext">
            Deleted expenses and receipts will appear here and remain recoverable for {retentionDays} days.
          </p>
        </div>
      ) : (
        <div className="recycle-bin__groups">
          {expenses.length > 0 && (
            <div className="recycle-bin__group">
              <h4 className="recycle-bin__group-title">Deleted expenses ({expenses.length})</h4>
              {expenses.map(renderExpenseItem)}
            </div>
          )}
          {receipts.length > 0 && (
            <div className="recycle-bin__group">
              <h4 className="recycle-bin__group-title">Deleted receipts ({receipts.length})</h4>
              {receipts.map(renderReceiptItem)}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!purgeTarget}
        onClose={() => {
          if (!isPurging) setPurgeTarget(null);
        }}
        title="Delete permanently?"
        dismissOnOverlayClick={!isPurging}
      >
        {purgeTarget && (
          <div className="confirm-dialog">
            <p className="confirm-dialog__text">
              Permanently delete <span className="confirm-dialog__name">"{purgeTarget.label}"</span>?
            </p>
            <p className="confirm-dialog__note">
              This cannot be undone. The record and any receipt image are removed for good.
            </p>
            <div className="confirm-dialog__actions">
              <button
                className="neo-btn neo-btn--secondary"
                type="button"
                onClick={() => setPurgeTarget(null)}
                disabled={isPurging}
              >
                Cancel
              </button>
              <button
                className="neo-btn neo-btn--danger"
                type="button"
                onClick={confirmPurge}
                disabled={isPurging}
              >
                {isPurging ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEmptyOpen}
        onClose={() => {
          if (!isEmptying) setIsEmptyOpen(false);
        }}
        title="Empty Recycle Bin?"
        dismissOnOverlayClick={!isEmptying}
      >
        <div className="confirm-dialog">
          <p className="confirm-dialog__text">
            This will permanently delete all items currently in the Recycle Bin. This action cannot be undone.
          </p>
          <p className="recycle-bin__empty-warning">
            {expenses.length} expense(s) and {receipts.length} receipt(s) will be removed for good, including their receipt images.
          </p>
          <div className="confirm-dialog__actions">
            <button
              className="neo-btn neo-btn--secondary"
              type="button"
              onClick={() => setIsEmptyOpen(false)}
              disabled={isEmptying}
            >
              Cancel
            </button>
            <button
              className="neo-btn neo-btn--danger"
              type="button"
              onClick={confirmEmpty}
              disabled={isEmptying}
            >
              {isEmptying ? 'Emptying...' : 'Empty Recycle Bin'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
