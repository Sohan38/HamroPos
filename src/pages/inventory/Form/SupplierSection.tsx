import React, { useCallback } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SectionProps } from './types';
import { Supplier } from '@/types';
import { Plus, Package } from 'lucide-react';

interface SupplierSectionProps extends SectionProps {
  suppliers: Supplier[];
  onSupplierNew: () => void;
}

export const SupplierSection = React.memo(({ form, suppliers, onSupplierNew }: SupplierSectionProps) => {
  const selectedSupplierIds: string[] = useWatch({ control: form.control, name: 'supplierIds' }) ?? [];
  const supplierStocks: any[] = useWatch({ control: form.control, name: 'supplierStocks' }) ?? [];

  const isMultiSupplier = selectedSupplierIds.length >= 2;

  const toggleSupplier = useCallback((sid: string) => {
    const isAdding = !selectedSupplierIds.includes(sid);
    const next = isAdding
      ? [...selectedSupplierIds, sid]
      : selectedSupplierIds.filter(s => s !== sid);

    form.setValue('supplierIds', next, { shouldDirty: true });

    // Sync supplierStocks: add or remove entries as suppliers change.
    // When adding a new supplier, seed its cost from the current global purchaseRate.
    // For stock: only the FIRST supplier selected inherits the global stock value;
    // subsequent suppliers start at 0 so the user can split stock manually.
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    const currentPurchaseRate = form.getValues('purchaseRate') ?? 0;
    const isFirstSupplier = isAdding && next.length === 1;
    const globalStock = isFirstSupplier ? (form.getValues('quantity') ?? 0) : 0;
    const nextStocks = next.map(id => {
      const existing = currentStocks.find((ss: any) => ss.supplierId === id);
      if (existing) return existing;
      // New supplier: seed cost (always) and stock (only for the very first supplier)
      return { supplierId: id, cost: currentPurchaseRate, stock: globalStock, supplierSku: '', reorderLevel: undefined, notes: '' };
    });
    form.setValue('supplierStocks', nextStocks, { shouldDirty: true });
  }, [selectedSupplierIds, form]);

  const updateSupplierStock = useCallback((supplierId: string, field: string, value: string | number | undefined) => {
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    const updated = currentStocks.map((ss: any) =>
      ss.supplierId === supplierId ? { ...ss, [field]: value } : ss
    );
    form.setValue('supplierStocks', updated, { shouldDirty: true });
  }, [form]);

  return (
    <section className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suppliers</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-primary"
          onClick={onSupplierNew}
        >
          <Plus className="h-3 w-3" /> New Supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <Package className="mx-auto h-7 w-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No suppliers yet.</p>
          <button
            type="button"
            className="text-primary underline text-xs mt-1"
            onClick={onSupplierNew}
          >
            Add your first supplier
          </button>
        </div>
      ) : (
        <>
          {/* Supplier selection chips */}
          <div className="flex flex-wrap gap-1.5">
            {suppliers.map(s => {
              const isSelected = selectedSupplierIds.includes(s.id);
              const isInactive = (s.status ?? 'active') === 'inactive';
              return (
                <Badge
                  key={s.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs py-1 px-2.5 transition-all select-none active:scale-95 ${isInactive && !isSelected ? 'opacity-50' : ''
                    }`}
                  onClick={() => toggleSupplier(s.id)}
                >
                  {s.name}
                  {isInactive && <span className="ml-1 opacity-60">(inactive)</span>}
                </Badge>
              );
            })}
          </div>

          {/* Per-supplier stock entries — shown whenever at least one supplier is selected */}
          {selectedSupplierIds.length > 0 && (
            <div className="space-y-3 pt-1">
              {isMultiSupplier && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <Package className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Multiple suppliers selected. Enter stock per supplier — total stock is calculated automatically.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {selectedSupplierIds.map((sid, idx) => {
                  const supplier = suppliers.find(s => s.id === sid);
                  if (!supplier) return null;
                  const stockEntry = supplierStocks.find((ss: any) => ss.supplierId === sid) ?? {
                    supplierId: sid, cost: 0, stock: 0,
                  };

                  return (
                    <div key={sid} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      {/* Supplier label */}
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate">{supplier.name}</span>
                        {isMultiSupplier && idx === 0 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-auto">Primary</Badge>
                        )}
                      </div>

                      {/* Cost + Stock row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {isMultiSupplier ? 'Stock from this supplier' : 'Supplier Stock'}
                            {isMultiSupplier && <span className="text-destructive ml-0.5">*</span>}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={stockEntry.stock === 0 ? '' : stockEntry.stock}
                            onChange={e => updateSupplierStock(sid, 'stock', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-8 text-sm"
                            readOnly={!isMultiSupplier}
                            disabled={!isMultiSupplier}
                          />
                          {!isMultiSupplier && (
                            <p className="text-[10px] text-muted-foreground">Edit in Stock & Unit section</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Supplier Cost</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0.00"
                            value={stockEntry.cost === 0 ? '' : stockEntry.cost}
                            onChange={e => updateSupplierStock(sid, 'cost', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* Optional fields — SKU + Reorder Level */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Supplier SKU <span className="opacity-50">(optional)</span></Label>
                          <Input
                            type="text"
                            placeholder="e.g. SUP-001"
                            value={stockEntry.supplierSku ?? ''}
                            onChange={e => updateSupplierStock(sid, 'supplierSku', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Reorder Level <span className="opacity-50">(optional)</span></Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 10"
                            value={stockEntry.reorderLevel == null ? '' : stockEntry.reorderLevel}
                            onChange={e => updateSupplierStock(sid, 'reorderLevel', e.target.value === '' ? undefined : Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
});

SupplierSection.displayName = 'SupplierSection';
