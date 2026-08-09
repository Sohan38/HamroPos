import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Supplier } from '@/types';
import { rankSearch } from '@/utils/search/rank';
import { X } from 'lucide-react';

interface SupplierSearchListProps {
    suppliers: Supplier[];
    selectedSupplierIds?: string[];
    onSelect: (id: string) => void;
    onAddNew?: (query: string) => void;
    placeholder?: string;
    emptyMessage?: string;
    label?: string;
    maxVisible?: number;
}

export function SupplierSearchList({
    suppliers,
    selectedSupplierIds = [],
    onSelect,
    onAddNew,
    placeholder = 'Type to filter suppliers...',
    emptyMessage = 'No more suppliers to add.',
    label = 'Supplier',
    maxVisible = 8,
}: SupplierSearchListProps) {
    const [query, setQuery] = useState('');

    const unselectedSuppliers = useMemo(
        () => suppliers.filter(supplier => !selectedSupplierIds.includes(supplier.id)),
        [suppliers, selectedSupplierIds],
    );

    const selectableSuppliers = useMemo(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            return unselectedSuppliers.slice(0, maxVisible);
        }
        return rankSearch(unselectedSuppliers, trimmed, 20);
    }, [unselectedSuppliers, query, maxVisible]);

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

            {selectableSuppliers.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
                    {selectableSuppliers.map(supplier => {
                        const isInactive = (supplier.status ?? 'active') === 'inactive';
                        return (
                            <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                    onSelect(supplier.id);
                                    setQuery('');
                                }}
                                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all select-none active:scale-95 shrink-0 ${isInactive ? 'opacity-40 border-border bg-muted/50 text-foreground' : 'border-border bg-muted/50 text-foreground hover:border-primary/50 hover:bg-primary/5'}`}
                            >
                                <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {supplier.name.charAt(0).toUpperCase()}
                                </span>
                                {supplier.name}
                                {isInactive && <span className="opacity-60">(off)</span>}
                            </button>
                        );
                    })}
                </div>
            ) : query.trim() && unselectedSuppliers.length > 0 ? (
                <div className="text-center py-4 border border-dashed rounded-2xl bg-muted/10 space-y-1">
                    <p className="text-xs text-muted-foreground">No matching suppliers found.</p>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    {emptyMessage}
                    {onAddNew && query.trim() && (
                        <div className="mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => onAddNew(query)}>
                                Add "{query}" as new supplier
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
