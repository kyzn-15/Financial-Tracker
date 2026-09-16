import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { ExpenseFolder, FolderStore } from '../types';
import { getErrorMessage } from '../utils/errors';

export function useFolders(): FolderStore {
  const [folders, setFolders] = useState<ExpenseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFolders();
      setFolders(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load folders.'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const createFolder = async (name: string): Promise<ExpenseFolder> => {
    setError(null);
    try {
      const created = await api.createFolder(name);
      setFolders((prev) => [...prev.filter((folder) => folder.id !== created.id), created]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
      return created;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create folder.'));
      throw err;
    }
  };

  return { folders, loading, error, refresh, createFolder };
}
