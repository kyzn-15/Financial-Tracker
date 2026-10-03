import { useCallback, useState } from 'react';
import * as api from '../services/api';
import type { EmptyRecycleBinResult, RecycleBinContents, RecycleBinStore } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useRecycleBin(): RecycleBinStore {
  const [contents, setContents] = useState<RecycleBinContents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<RecycleBinContents> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecycleBin();
      setContents(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the Recycle Bin.'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(async <T,>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T> => {
    setBusyId(key);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(getErrorMessage(err, 'Recycle Bin action failed.'));
      throw err;
    } finally {
      setBusyId(null);
    }
  }, []);

  const refresh = useCallback(async (): Promise<RecycleBinContents> => {
    try {
      return await api.getRecycleBin();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not refresh the Recycle Bin.'));
      throw err;
    }
  }, []);

  const restoreExpense = useCallback(async (id: number): Promise<void> => {
    await runAction(`expense-${id}`, () => api.restoreRecycledExpense(id));
    await refresh();
  }, [runAction, refresh]);

  const purgeExpense = useCallback(async (id: number): Promise<void> => {
    await runAction(`expense-${id}`, () => api.purgeRecycledExpense(id));
    await refresh();
  }, [runAction, refresh]);

  const restoreReceipt = useCallback(async (id: number): Promise<void> => {
    await runAction(`receipt-${id}`, () => api.restoreRecycledReceipt(id));
    await refresh();
  }, [runAction, refresh]);

  const purgeReceipt = useCallback(async (id: number): Promise<void> => {
    await runAction(`receipt-${id}`, () => api.purgeRecycledReceipt(id));
    await refresh();
  }, [runAction, refresh]);

  const emptyBin = useCallback(async (): Promise<EmptyRecycleBinResult> => {
    const result = await runAction('empty', () => api.emptyRecycleBin());
    await refresh();
    return result;
  }, [runAction, refresh]);

  return {
    contents,
    loading,
    error,
    busyId,
    load,
    refresh,
    restoreExpense,
    purgeExpense,
    restoreReceipt,
    purgeReceipt,
    emptyBin,
  };
}
