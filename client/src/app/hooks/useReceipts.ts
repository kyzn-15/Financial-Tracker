import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import type { AppTab, Receipt } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useReceipts(activeTab: AppTab) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load receipts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'receipts') {
      fetchReceipts();
    }
  }, [activeTab, fetchReceipts]);

  const saveReceipt = async (file: File): Promise<Receipt> => {
    const result = await api.uploadReceipt(file);
    await fetchReceipts();
    return result;
  };

  const removeReceipt = async (id: number): Promise<void> => {
    await api.deleteReceipt(id);
    await fetchReceipts();
  };

  return {
    receipts,
    loading,
    error,
    saveReceipt,
    removeReceipt,
    refreshReceipts: fetchReceipts,
  };
}
