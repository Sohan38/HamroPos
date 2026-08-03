import { useState, useMemo } from 'react';
import { rankSearch } from '@/utils/search/rank';

export function useSearch<T>(items: T[], searchFields: (keyof T)[], initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;

    // Use rankSearch for smart ranking based on exact match, prefix, etc.
    const ranked = rankSearch(items as any[], query, items.length);

    if (ranked.length > 0) {
      return ranked as T[];
    }

    // Fallback to simple matching if no scores are produced (e.g. searching other text fields)
    const lowerQuery = query.toLowerCase();
    return items.filter((item) => {
      return searchFields.some((field) => {
        const value = item[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      });
    });
  }, [items, query, searchFields]);

  return { query, setQuery, filteredItems };
}
