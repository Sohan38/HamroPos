import { SupplierSearchList } from '@/components/SupplierSearchList';
import { Button } from '@/components/ui/button';
import { Supplier } from '@/types';
import { Truck } from 'lucide-react';
import { X } from 'lucide-react';

interface SupplierSearchPickerProps {
    suppliers: Supplier[];
    selectedSupplierId?: string;
    onSelect: (id: string) => void;
    onRemove: () => void;
    onAddNewSupplier?: (query: string) => void;
    placeholder?: string;
    emptyMessage?: string;
}

export function SupplierSearchPicker({
    suppliers,
    selectedSupplierId,
    onSelect,
    onRemove,
    onAddNewSupplier,
    placeholder = 'Search suppliers by name or phone...',
    emptyMessage = 'No suppliers available.',
}: SupplierSearchPickerProps) {
    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

    return (
        <div className="space-y-4">
            <SupplierSearchList
                suppliers={suppliers}
                selectedSupplierIds={selectedSupplierId ? [selectedSupplierId] : []}
                onSelect={onSelect}
                onAddNew={onAddNewSupplier}
                placeholder={placeholder}
                emptyMessage={emptyMessage}
                label="Supplier *"
                maxVisible={8}
            />

            {selectedSupplier && (
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 border-b">
                        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-[11px]">
                            {selectedSupplier.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold truncate flex-1">{selectedSupplier.name}</span>
                        {(selectedSupplier.status ?? 'active') === 'inactive' && (
                            <span className="text-[11px] text-muted-foreground">(off)</span>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
