import type { ChangeEvent } from 'react';
import AppIcon from './AppIcon';
import CategorySelect from './CategorySelect';
import OptionSelect from './OptionSelect';
import type { Category, ExpenseFilters, ExpenseFolder } from '../types';

interface FilterBarProps {
  categories?: Category[];
  folders?: ExpenseFolder[];
  filters: ExpenseFilters;
  onChange: (filters: Partial<ExpenseFilters>) => void;
  onClear: () => void;
}

export default function FilterBar({ categories = [], folders = [], filters, onChange, onClear }: FilterBarProps) {
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ name: e.target.value });
  };

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ startDate: e.target.value });
  };

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ endDate: e.target.value });
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
        <CategorySelect
          id="filter-category"
          choices={categories.map((category) => ({ name: category.name, usageCount: category.usage_count }))}
          value={filters.category}
          onChange={(category) => onChange({ category })}
          emptyLabel="All Categories"
          dialogTitle="Filter by category"
          ariaLabel="Filter by category"
        />
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label" htmlFor="filter-folder">Folder</label>
        <OptionSelect
          id="filter-folder"
          dialogTitle="Filter by folder"
          ariaLabel="Filter by folder"
          value={filters.folderId}
          onChange={(folderId) => onChange({ folderId })}
          options={[
            { value: '', label: 'All Folders', icon: 'folder' },
            { value: 'ungrouped', label: 'Ungrouped', icon: 'folder' },
            ...folders.map((folder) => ({ value: String(folder.id), label: folder.name, icon: 'folder' })),
          ]}
        />
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
