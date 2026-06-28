import React, { useState } from 'react';
import { formatMYR, formatIDR, formatDateTime, CATEGORY_ICONS } from '../utils/formatters';

export default function ExpenseList({ expenses, filters, onSort, onEdit, onDelete }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination logic
  const totalItems = expenses.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  // Reset to page 1 if list changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [expenses]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = expenses.slice(startIndex, startIndex + itemsPerPage);

  const getSortIcon = (column) => {
    if (filters.sort !== column) return '↕️';
    return filters.order === 'asc' ? '🔼' : '🔽';
  };

  const getHeaderClass = (column) => {
    return filters.sort === column ? 'sorted' : '';
  };

  return (
    <div className="neo-card">
      <h2 className="neo-card__title">
        <span className="card-icon">📋</span> Expense Records ({totalItems})
      </h2>

      {totalItems === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <div className="empty-state__text">No expenses found</div>
          <div className="empty-state__sub">Try adjusting your filters or add a new expense.</div>
        </div>
      ) : (
        <>
          <div className="expense-table-wrapper">
            <table className="expense-table">
              <thead>
                <tr>
                  <th className={getHeaderClass('timestamp')} onClick={() => onSort('timestamp')}>
                    Date {getSortIcon('timestamp')}
                  </th>
                  <th className={getHeaderClass('name')} onClick={() => onSort('name')}>
                    Name {getSortIcon('name')}
                  </th>
                  <th className={getHeaderClass('category')} onClick={() => onSort('category')}>
                    Category {getSortIcon('category')}
                  </th>
                  <th className={getHeaderClass('price_myr')} onClick={() => onSort('price_myr')}>
                    Price (MYR) {getSortIcon('price_myr')}
                  </th>
                  <th className={getHeaderClass('price_idr')} onClick={() => onSort('price_idr')}>
                    Price (IDR) {getSortIcon('price_idr')}
                  </th>
                  <th>Exchange Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((expense) => {
                  const isMYR = expense.original_currency === 'MYR';
                  const rate = expense.exchange_rate_used
                    ? Number(expense.exchange_rate_used).toLocaleString('en', { maximumFractionDigits: 2 })
                    : 'Pending';

                  return (
                    <tr key={expense.id}>
                      <td data-label="Date">{formatDateTime(expense.timestamp)}</td>
                      <td data-label="Name" style={{ fontWeight: 600 }}>{expense.name}</td>
                      <td data-label="Category">
                        <span className="category-badge">
                          <span>{CATEGORY_ICONS[expense.category] || '📌'}</span>
                          <span>{expense.category}</span>
                        </span>
                      </td>
                      <td data-label="Price (MYR)">
                        <div className={isMYR ? 'price-original' : 'price-converted'}>
                          {formatMYR(expense.price_myr)}
                          {isMYR && <span style={{ fontSize: '10px', marginLeft: '4px', verticalAlign: 'middle' }}>⭐</span>}
                        </div>
                      </td>
                      <td data-label="Price (IDR)">
                        <div className={!isMYR ? 'price-original' : 'price-converted'}>
                          {formatIDR(expense.price_idr)}
                          {!isMYR && <span style={{ fontSize: '10px', marginLeft: '4px', verticalAlign: 'middle' }}>⭐</span>}
                        </div>
                      </td>
                      <td data-label="Exchange Rate" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {expense.exchange_rate_used ? `1 MYR = ${rate} IDR` : 'Pending'}
                      </td>
                      <td data-label="Actions">
                        <div className="actions-cell">
                          <button
                            className="neo-btn neo-btn--secondary neo-btn--icon"
                            onClick={() => onEdit(expense)}
                            title="Edit expense"
                          >
                            ✏️
                          </button>
                          <button
                            className="neo-btn neo-btn--danger neo-btn--icon"
                            onClick={() => onDelete(expense)}
                            title="Delete expense"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="neo-btn neo-btn--secondary neo-btn--sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                ◀ Prev
              </button>
              <span className="pagination__info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="neo-btn neo-btn--secondary neo-btn--sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
