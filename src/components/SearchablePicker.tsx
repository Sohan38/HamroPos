/**
 * SearchablePicker — Reusable search + chip-style picker component.
 *
 * Shows a ranked/filtered list of items as tappable chips.
 * When an item is selected it renders as a dismissable badge.
 * Uses rankSearch from @/utils/search/rank for scored filtering.
 *
 * Items must have at least: id, name.  Additional fields (phone, category,
 * barcode, sublabel) are optional display / search hints.
 *
 * Props:
 *  - singleRow: when true chips render in a single horizontally-scrollable
 *               row instead of wrapping. Ideal for product pickers.
 *  - defaultLimit: max chips shown without search query (default 6).
 */
import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { rankSearch } from '@/utils/search/rank';

export interface PickerItem {
  id: string;
  name: string;
  /** Shown below name in the chip list */
  sublabel?: string;
  /** Passed into rankSearch for phone-based scoring */
  phone?: string | null;
  /** Passed into rankSearch for category-based scoring */
  category?: string | null;
  /** Passed into rankSearch for barcode-based scoring */
  barcode?: string | null;
  /** If true, the chip is visually faded */
  inactive?: boolean;
}

interface SearchablePickerProps {
  /** Pool of all available items */
  items: PickerItem[];
  /** Currently selected item id(s) — can be one or many depending on `multi` */
  selectedIds: string[];
  /** Called when an item chip is tapped */
  onSelect: (id: string) => void;
  /** Called when the × on a selected chip is tapped */
  onRemove: (id: string) => void;
  /** Search input placeholder */
  placeholder?: string;
  /** Placeholder shown when no items exist at all */
  emptyMessage?: string;
  /** Max chips shown before search query is entered. Default 6 */
  defaultLimit?: number;
  /** Disable the whole picker */
  disabled?: boolean;
  /** Optional label shown above */
  label?: string;
  /** Optional class override for outer wrapper */
  className?: string;
  /** Whether multiple items can be selected simultaneously */
  multi?: boolean;
  /**
   * When true, chips render in a single horizontally-scrollable row instead
   * of wrapping. Best for product pickers where you want a compact scannable strip.
   */
  singleRow?: boolean;
}

export function SearchablePicker({
  items,
  selectedIds,
  onSelect,
  onRemove,
  placeholder = 'Search...',
  emptyMessage = 'No items found.',
  defaultLimit = 6,
  disabled = false,
  label,
  className,
  multi = false,
  singleRow = false,
}: SearchablePickerProps) {
  const [query, setQuery] = useState('');

  const selectedItems = useMemo(
    () => selectedIds.map(id => items.find(i => i.id === id)).filter(Boolean) as PickerItem[],
    [items, selectedIds],
  );

  const unselectedItems = useMemo(
    () => items.filter(i => !selectedIds.includes(i.id)),
    [items, selectedIds],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return unselectedItems.slice(0, defaultLimit);
    return rankSearch(unselectedItems, query, 20);
  }, [unselectedItems, query, defaultLimit]);

  // In single-select mode hide the picker once something is chosen
  const showPicker = multi || selectedIds.length === 0;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <p className="text-sm font-medium">{label}</p>
      )}

      {/* Selected item(s) badges */}
      {selectedItems.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {selectedItems.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-sm font-semibold"
            >
              <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                {item.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate max-w-[160px]">{item.name}</span>
              {item.sublabel && (
                <span className="text-primary/60 text-xs font-normal">{item.sublabel}</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-primary/60 hover:text-primary transition-colors shrink-0"
                aria-label={`Remove ${item.name}`}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + chips */}
      {showPicker && !disabled && (
        <div className="space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Chips */}
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
              {emptyMessage}
            </p>
          ) : filteredItems.length > 0 ? (
            <div
              className={cn(
                singleRow
                  // Single row: scroll left-right, never wrap, add padding to show scroll affordance
                  ? 'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                  : 'flex gap-1.5 flex-wrap',
              )}
            >
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item.id); setQuery(''); }}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium border transition-all active:scale-95 shrink-0',
                    singleRow
                      ? 'px-3.5 py-2 rounded-xl' // slightly taller + rounder for single-row strip
                      : 'px-3 py-1.5 rounded-full',
                    'bg-muted/50 border-border text-foreground hover:border-primary/50 hover:bg-primary/5',
                    item.inactive && 'opacity-40',
                  )}
                >
                  {!singleRow && (
                    <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                      {item.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={cn('whitespace-nowrap', !singleRow && 'truncate max-w-[140px]')}>{item.name}</span>
                  {item.sublabel && (
                    <span className="text-muted-foreground/70 whitespace-nowrap">{item.sublabel}</span>
                  )}
                  {item.inactive && <span className="opacity-60">(inactive)</span>}
                </button>
              ))}
            </div>
          ) : query ? (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-xl">
              No results for "{query}"
            </p>
          ) : null}
        </div>
      )}

      {/* Disabled placeholder */}
      {disabled && selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">{placeholder}</p>
      )}
    </div>
  );
}
