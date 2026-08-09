import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rankSearch } from '@/utils/search/rank';
import { X } from 'lucide-react';

export interface ProductSearchPickerItem {
    id: string;
    name: string;
    barcode?: string;
    category?: string;
    sublabel?: string;
}

interface ProductSearchPickerProps {
    label?: string;
    items: ProductSearchPickerItem[];
    onSelect: (id: string) => void;
    disabled?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    defaultLimit?: number;
}

export function ProductSearchPicker({
    label = 'Products',
    items,
    onSelect,
    disabled = false,
    placeholder = 'Search by product name or barcode...',
    emptyMessage = 'No products found.',
    defaultLimit = 8,
}: ProductSearchPickerProps) {
    const [query, setQuery] = useState('');

    const selectableItems = useMemo(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            return items.slice(0, defaultLimit);
        }
        return rankSearch(items, trimmed, defaultLimit);
    }, [items, query, defaultLimit]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">{label}</label>
                <div className="relative">
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        disabled={disabled}
                        className="h-9 text-sm rounded-xl"
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
            </div>

            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    {emptyMessage}
                </div>
            ) : (
                <>
                    <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
                        {selectableItems.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelect(item.id)}
                                disabled={disabled}
                                className="flex flex-col items-start gap-1 text-left text-xs font-medium px-3 py-2 rounded-full border bg-muted/50 border-border text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span className="font-semibold truncate max-w-45">{item.name}</span>
                                {item.sublabel && <span className="text-[11px] text-muted-foreground">{item.sublabel}</span>}
                            </button>
                        ))}
                    </div>

                    {selectableItems.length === 0 && query.trim() && (
                        <div className="text-center py-4 border border-dashed rounded-2xl bg-muted/10 space-y-1">
                            <p className="text-xs text-muted-foreground">No matching products found.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
