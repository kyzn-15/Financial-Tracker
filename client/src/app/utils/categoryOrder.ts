import { useCallback, useState } from 'react';
import type { Category } from '../types';

export const CATEGORY_AUTOSORT_KEY = 'financial-tracker-category-autosort';

export function readCategoryAutosort(): boolean {
  return window.localStorage.getItem(CATEGORY_AUTOSORT_KEY) !== 'false';
}

export function writeCategoryAutosort(enabled: boolean): void {
  window.localStorage.setItem(CATEGORY_AUTOSORT_KEY, String(enabled));
}

export function orderCategoriesByUse(categories: Category[]): Category[] {
  return categories
    .map((category, index) => ({ category, index }))
    .sort((left, right) => {
      const byUse = right.category.usage_count - left.category.usage_count;
      if (byUse !== 0) return byUse;
      return left.category.sort_order - right.category.sort_order
        || left.category.id - right.category.id
        || left.index - right.index;
    })
    .map((item) => item.category);
}

export function useCategoryAutosort(): readonly [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(readCategoryAutosort);
  const update = useCallback((next: boolean) => {
    writeCategoryAutosort(next);
    setEnabled(next);
  }, []);
  return [enabled, update];
}
