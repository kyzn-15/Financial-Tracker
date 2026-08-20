import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { Category, CategoryStore } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useCategories(): CategoryStore {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategories();
      setCategories(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load categories.'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const runMutation = async (request: () => Promise<Category[]>): Promise<Category[]> => {
    setError(null);
    try {
      const data = await request();
      setCategories(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update categories.'));
      throw err;
    }
  };

  return {
    categories,
    loading,
    error,
    refresh,
    addCategory: (name) => runMutation(() => api.createCategory(name)),
    renameCategory: (id, name) => runMutation(() => api.renameCategory(id, name)),
    removeCategory: (id) => runMutation(() => api.deleteCategory(id)),
    reorderCategories: (ids) => runMutation(() => api.reorderCategories(ids)),
    updateAutomation: (id, enabled, frequency) => runMutation(() => api.updateCategoryAutomation(id, enabled, frequency)),
  };
}
