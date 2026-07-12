import React from 'react';
import { CATEGORIES } from '../utils/formatters';

export default function FilterBar({ filters, onChange, onClear }) {
  const handleCategoryChange = (e) => {
    onChange({ category: e.target.value });
  };

  const handleNameChange = (e) => {
    onChange({ name: e.target.value });
  };

  const handleStartDateChange = (e) => {
    onChange({ startDate: e.target.value });
  };

  const handleEndDateChange = (e) => {
    onChange({ endDate: e.target.value });
  };

  const hasActiveFilters = filters.name || filters.category || filters.startDate || filters.endDate;

  return (
    <div className="filter-bar neo-card neo-card--sm">
      <div className="filter-bar__group filter-bar__group--search">
        <label className="filter-bar__label" htmlFor="filter-name">Search expense</label>
        <input
          id="filter-name"
          type="search"
          className="neo-input"
          value={filters.name}
          onChange={handleNameChange}
          placeholder="Search by expense name"
        />
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label" htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          className="neo-select"
          value={filters.category}
          onChange={handleCategoryChange}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label" htmlFor="filter-start-date">Start Date</label>
        <input
          id="filter-start-date"
          type="date"
          className="neo-input"
          value={filters.startDate ? filters.startDate.split('T')[0] : ''}
          onChange={handleStartDateChange}
        />
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label" htmlFor="filter-end-date">End Date</label>
        <input
          id="filter-end-date"
          type="date"
          className="neo-input"
          value={filters.endDate ? filters.endDate.split('T')[0] : ''}
          onChange={handleEndDateChange}
        />
      </div>

      {hasActiveFilters && (
        <button
          className="neo-btn neo-btn--secondary neo-btn--sm"
          onClick={onClear}
          type="button"
        >
          🧹 Clear Filters
        </button>
      )}
    </div>
  );
}
