import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { RecurringExpense, RecurringExpenseInput, RecurringExpenseStore } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useRecurringExpenses(): RecurringExpenseStore {
  const [rules, setRules] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecurringExpenses();
      setRules(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load recurring payments.'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const refreshRules = () => refresh().catch(() => {});
    const interval = window.setInterval(refreshRules, 60_000);
    window.addEventListener('focus', refreshRules);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshRules);
    };
  }, [refresh]);

  const update = async (id: number, data: RecurringExpenseInput): Promise<RecurringExpense> => {
    setError(null);
    try {
      const rule = await api.updateRecurringExpense(id, data);
      setRules((current) => current.map((item) => item.id === id ? rule : item));
      return rule;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update recurring payment.'));
      throw err;
    }
  };

  const cancel = async (id: number): Promise<void> => {
    setError(null);
    try {
      await api.cancelRecurringExpense(id);
      setRules((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cancel recurring payment.'));
      throw err;
    }
  };

  return { rules, loading, error, refresh, update, cancel };
}
