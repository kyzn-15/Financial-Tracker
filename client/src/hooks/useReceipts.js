import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

export function useReceipts(activeTab) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'receipts') {
      fetchReceipts();
    }
  }, [activeTab, fetchReceipts]);

  const saveReceipt = async (file) => {
    const result = await api.uploadReceipt(file);
    await fetchReceipts();
    return result;
  };

  const removeReceipt = async (id) => {
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
