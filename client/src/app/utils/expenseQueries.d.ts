import type { ExpenseFilters } from '../types';

export function unfilteredExpenseQuery(): Pick<ExpenseFilters, 'sort' | 'order'>;
