import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';

export function useRecurringExpenses() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecurringExpenses();
      setRules(data);
      return data;
    } catch (err) {
      setError(err.message);
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

  const update = async (id, data) => {
    setError(null);
    try {
      const rule = await api.updateRecurringExpense(id, data);
      setRules((current) => current.map((item) => item.id === id ? rule : item));
      return rule;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const cancel = async (id) => {
    setError(null);
    try {
      await api.cancelRecurringExpense(id);
      setRules((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { rules, loading, error, refresh, update, cancel };
}
