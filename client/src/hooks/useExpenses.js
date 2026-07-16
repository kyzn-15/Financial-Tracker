import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    name: '',
    category: '',
    startDate: '',
    endDate: '',
    sort: 'timestamp',
    order: 'desc',
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExpenses(filters);
      setExpenses(data);
    } catch (err) {
      setError(err.message);
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
    fetchSummary();
    fetchExchangeRate();
  }, [fetchSummary, fetchExchangeRate]);

  const addExpense = async (data) => {
    const result = await api.createExpense(data);
    await fetchExpenses();
    await fetchSummary();
    return result;
  };

  const editExpense = async (id, data) => {
    const result = await api.updateExpense(id, data);
    await fetchExpenses();
    await fetchSummary();
    return result;
  };

  const removeExpense = async (id) => {
    await api.deleteExpense(id);
    await fetchExpenses();
    await fetchSummary();
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const updateSort = (column) => {
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
      startDate: '',
      endDate: '',
      sort: 'timestamp',
      order: 'desc',
    });
  };

  return {
    expenses,
    summary,
    exchangeRate,
    loading,
    error,
    filters,
    addExpense,
    editExpense,
    removeExpense,
    updateFilters,
    updateSort,
    clearFilters,
    refresh: () => Promise.all([fetchExpenses(), fetchSummary()]),
  };
}
