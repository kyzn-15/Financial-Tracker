import { useEffect, useState } from 'react';
import { formatCurrencyAmount, formatDateTime } from '../utils/formatters';
import { getCategoryIconName } from '../utils/categoryIcons';
import AppIcon from './AppIcon';
import type { Currency, ExchangeRate, Expense, ExpenseFilters, ExpenseSortColumn } from '../types';

interface ExpenseListProps {
  expenses: Expense[];
  filters: ExpenseFilters;
  currency?: Currency;
  exchangeRate: ExchangeRate | null;
  onSort: (column: ExpenseSortColumn) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, filters, currency = 'MYR', exchangeRate, onSort, onEdit, onDelete }: ExpenseListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalItems = expenses.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const isMYR = currency === 'MYR';
  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  const priceColumn: ExpenseSortColumn = isMYR ? 'price_myr' : 'price_idr';
  const formatCurrency = (amount: number) => formatCurrencyAmount(amount, currency, myrToIdr);
  const paginatedExpenses = expenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => setCurrentPage(1), [expenses]);

  const getSortIcon = (column: ExpenseSortColumn): string => filters.sort !== column ? 'arrow-up-down' : filters.order === 'asc' ? 'arrow-up' : 'arrow-down';
  const getHeaderClass = (column: ExpenseSortColumn): string => filters.sort === column ? 'sorted' : '';

  return (
    <div className="clay-card">
      <h2 className="clay-card__title"><span className="card-icon"><AppIcon name="clipboard" /></span> Expense Records ({totalItems})</h2>
      {totalItems === 0 ? <div className="empty-state"><div className="empty-state__icon"><AppIcon name="search" size={28} /></div><div className="empty-state__text">No expenses found</div><div className="empty-state__sub">Try adjusting your filters or add a new expense.</div></div> : <>
        <div className="expense-table-wrapper">
          <table className="expense-table">
            <thead><tr>
              <th className={getHeaderClass('timestamp')} onClick={() => onSort('timestamp')}>Date <AppIcon name={getSortIcon('timestamp')} size={13} /></th>
              <th className={getHeaderClass('name')} onClick={() => onSort('name')}>Name <AppIcon name={getSortIcon('name')} size={13} /></th>
              <th>Type</th>
              <th className={getHeaderClass('category')} onClick={() => onSort('category')}>Category <AppIcon name={getSortIcon('category')} size={13} /></th>
              <th className={getHeaderClass(priceColumn)} onClick={() => onSort(priceColumn)}>Price ({currency}) <AppIcon name={getSortIcon(priceColumn)} size={13} /></th>
              <th>Exchange Rate</th><th>Actions</th>
            </tr></thead>
            <tbody>{paginatedExpenses.map((expense) => {
              const isOriginalCurrency = expense.original_currency === currency;
              const rate = expense.exchange_rate_used ? Number(expense.exchange_rate_used).toLocaleString('en', { maximumFractionDigits: 2 }) : 'Pending';
              const amount = expense.price_myr;
              return <tr key={expense.id}>
                <td data-label="Date">{formatDateTime(expense.timestamp)}</td>
                <td data-label="Name" className="expense-table__name">{expense.name}</td>
                <td data-label="Type">
                  {expense.recurring_rule_id ? (
                    <span className="expense-recurring-badge"><AppIcon name="refresh" size={12} /> Automated</span>
                  ) : (
                    <span className="expense-recurring-badge expense-recurring-badge--manual">Manual</span>
                  )}
                </td>
                <td data-label="Category"><span className="category-badge"><AppIcon name={getCategoryIconName(expense.category)} size={15} /><span>{expense.category}</span></span></td>
                <td data-label={`Price (${currency})`}><div className={isOriginalCurrency ? 'price-original' : 'price-converted'}>{formatCurrency(amount)}{isOriginalCurrency && <span className="price-original__marker" title="Original currency"><AppIcon name="badge-check" size={13} /></span>}</div></td>
                <td data-label="Exchange Rate" className="expense-table__rate">{expense.exchange_rate_used ? `1 MYR = ${rate} IDR` : 'Pending'}</td>
                <td data-label="Actions"><div className="actions-cell"><button className="clay-btn clay-btn--secondary clay-btn--icon" onClick={() => onEdit(expense)} title="Edit expense" aria-label="Edit expense"><AppIcon name="pencil" size={16} /></button><button className="clay-btn clay-btn--danger clay-btn--icon" onClick={() => onDelete(expense)} title="Delete expense" aria-label="Delete expense"><AppIcon name="trash" size={16} /></button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {totalPages > 1 && <div className="pagination"><button className="clay-btn clay-btn--secondary clay-btn--sm" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}><AppIcon name="arrow-left" size={15} /> Prev</button><span className="pagination__info">Page {currentPage} of {totalPages}</span><button className="clay-btn clay-btn--secondary clay-btn--sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}>Next <AppIcon name="arrow-right" size={15} /></button></div>}
      </>}
    </div>
  );
}
