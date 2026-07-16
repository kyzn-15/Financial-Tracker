import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategories();
      setCategories(data);
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

  const runMutation = async (request) => {
    setError(null);
    try {
      const data = await request();
      setCategories(data);
      return data;
    } catch (err) {
      setError(err.message);
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
  };
}
