import { useState, useMemo } from 'react';

export function useSearch<T>(items: T[], searchFields: (keyof T)[], initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;

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
