import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import type { ExchangeRate, Expense, ExpenseFilters, ExpenseInput, ExpenseSortColumn, Summary } from '../types';
import { getErrorMessage } from '../utils/errors';
import { unfilteredExpenseQuery } from '../utils/expenseQueries';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    name: '',
    category: '',
    folderId: '',
    startDate: '',
    endDate: '',
    sort: 'timestamp',
    order: 'desc',
  });

  const fetchAllExpenses = useCallback(async () => {
    try {
      const data = await api.getExpenses(unfilteredExpenseQuery());
      setAllExpenses(data);
    } catch (err) {
      console.error('Failed to fetch all expenses:', err);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExpenses(filters);
      setExpenses(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load expenses.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const data = await api.getExchangeRate();
      setExchangeRate(data);
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    fetchAllExpenses();
  }, [fetchAllExpenses]);

  useEffect(() => {
    fetchSummary();
    fetchExchangeRate();
  }, [fetchSummary, fetchExchangeRate]);

  useEffect(() => {
    const refreshCurrentData = () => {
      fetchExpenses();
      fetchAllExpenses();
      fetchSummary();
    };
    const interval = window.setInterval(refreshCurrentData, 60_000);
    window.addEventListener('focus', refreshCurrentData);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshCurrentData);
    };
  }, [fetchExpenses, fetchAllExpenses, fetchSummary]);

  const addExpense = async (data: ExpenseInput): Promise<Expense> => {
    const result = await api.createExpense(data);
    await fetchExpenses();
    await fetchAllExpenses();
    await fetchSummary();
    return result;
  };

  const editExpense = async (id: number, data: ExpenseInput): Promise<Expense> => {
    const result = await api.updateExpense(id, data);
    await fetchExpenses();
    await fetchAllExpenses();
    await fetchSummary();
    return result;
  };

  const removeExpense = async (id: number): Promise<void> => {
    await api.deleteExpense(id);
    await fetchExpenses();
    await fetchAllExpenses();
    await fetchSummary();
  };

  const assignFolder = async (id: number, folderId: number | null): Promise<Expense> => {
    const result = await api.assignExpenseFolder(id, folderId);
    await fetchExpenses();
    await fetchAllExpenses();
    await fetchSummary();
    return result;
  };

  const updateFilters = (newFilters: Partial<ExpenseFilters>): void => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const updateSort = (column: ExpenseSortColumn): void => {
    setFilters(prev => ({
      ...prev,
      sort: column,
      order: prev.sort === column && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      category: '',
      folderId: '',
      startDate: '',
      endDate: '',
      sort: 'timestamp',
      order: 'desc',
    });
  };

  return {
    expenses,
    allExpenses,
    summary,
    exchangeRate,
    loading,
    error,
    filters,
    addExpense,
    editExpense,
    removeExpense,
    assignFolder,
    updateFilters,
    updateSort,
    clearFilters,
    refresh: () => Promise.all([fetchExpenses(), fetchAllExpenses(), fetchSummary()]),
  };
}
