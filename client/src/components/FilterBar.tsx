import type { ChangeEvent } from 'react';
import AppIcon from './AppIcon';
import type { ExpenseFilters, ExpenseFolder } from '../types';

interface FilterBarProps {
  categories?: string[];
  folders?: ExpenseFolder[];
  filters: ExpenseFilters;
  onChange: (filters: Partial<ExpenseFilters>) => void;
  onClear: () => void;
}

export default function FilterBar({ categories = [], folders = [], filters, onChange, onClear }: FilterBarProps) {
  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ category: e.target.value });
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ name: e.target.value });
  };

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ startDate: e.target.value });
  };

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ endDate: e.target.value });
  };

  const handleFolderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ folderId: e.target.value });
  };

  const hasActiveFilters = filters.name || filters.category || filters.folderId || filters.startDate || filters.endDate;

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
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label" htmlFor="filter-folder">Folder</label>
        <select
          id="filter-folder"
          className="neo-select"
          value={filters.folderId}
          onChange={handleFolderChange}
        >
          <option value="">All Folders</option>
          <option value="ungrouped">Ungrouped</option>
          {folders.map((folder) => (
            <option key={folder.id} value={String(folder.id)}>
              {folder.name}
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
          <AppIcon name="eraser" size={15} /> Clear Filters
        </button>
      )}
    </div>
  );
}
