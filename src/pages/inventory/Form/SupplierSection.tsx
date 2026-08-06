import React, { useCallback } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SectionProps } from './types';
import { Supplier } from '@/types';
import { Plus, Package, Users, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierSectionProps extends SectionProps {
  suppliers: Supplier[];
  onSupplierNew: () => void;
}

export const SupplierSection = React.memo(({ form, suppliers, onSupplierNew }: SupplierSectionProps) => {
  const selectedSupplierIds: string[] = useWatch({ control: form.control, name: 'supplierIds' }) ?? [];
  const supplierStocks: any[]         = useWatch({ control: form.control, name: 'supplierStocks' }) ?? [];

  const isMultiSupplier = selectedSupplierIds.length >= 2;

  const toggleSupplier = useCallback((sid: string) => {
    const isAdding = !selectedSupplierIds.includes(sid);
    const next = isAdding
      ? [...selectedSupplierIds, sid]
      : selectedSupplierIds.filter(s => s !== sid);

    form.setValue('supplierIds', next, { shouldDirty: true });

    const currentStocks: any[]  = form.getValues('supplierStocks') ?? [];
    const currentPurchaseRate    = form.getValues('purchaseRate') ?? 0;
    const isFirstSupplier        = isAdding && next.length === 1;
    const globalStock            = isFirstSupplier ? (form.getValues('quantity') ?? 0) : 0;
    const nextStocks = next.map(id => {
      const existing = currentStocks.find((ss: any) => ss.supplierId === id);
      if (existing) return existing;
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
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suppliers</p>
          {selectedSupplierIds.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedSupplierIds.length}</Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-primary rounded-xl hover:bg-primary/10"
          onClick={onSupplierNew}
        >
          <Plus className="h-3.5 w-3.5" /> New Supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-muted rounded-2xl bg-muted/10 cursor-pointer active:bg-muted/20 transition-colors"
          onClick={onSupplierNew}
        >
          <Truck className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No suppliers yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Tap to add your first supplier</p>
        </div>
      ) : (
        <>
          {/* Supplier chips */}
          <div className="flex flex-wrap gap-2">
            {suppliers.map(s => {
              const isSelected = selectedSupplierIds.includes(s.id);
              const isInactive = (s.status ?? 'active') === 'inactive';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSupplier(s.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all select-none active:scale-95',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/50 border-border text-foreground hover:border-primary/50 hover:bg-primary/5',
                    isInactive && !isSelected && 'opacity-40'
                  )}
                >
                  <span className={cn(
                    'h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                    isSelected ? 'bg-white/20' : 'bg-muted'
                  )}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  {s.name}
                  {isInactive && <span className="opacity-60">(off)</span>}
                </button>
              );
            })}
          </div>

          {/* Multi-supplier info banner */}
          {isMultiSupplier && (
            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl px-3.5 py-3 text-xs text-blue-700 dark:text-blue-300">
              <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Multiple suppliers — enter each one's stock & cost below. Total stock is calculated automatically.</span>
            </div>
          )}

          {/* Per-supplier cards */}
          {selectedSupplierIds.length > 0 && (
            <div className="space-y-3">
              {selectedSupplierIds.map((sid, idx) => {
                const supplier   = suppliers.find(s => s.id === sid);
                if (!supplier) return null;
                const stockEntry = supplierStocks.find((ss: any) => ss.supplierId === sid)
                  ?? { supplierId: sid, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined };

                return (
                  <div key={sid} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 border-b">
                      <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-[11px] shrink-0">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold truncate flex-1">{supplier.name}</span>
                      {isMultiSupplier && idx === 0 && (
                        <Badge variant="outline" className="text-[9px] px-2 py-0 rounded-full border-primary/30 text-primary">Primary</Badge>
                      )}
                    </div>

                    {/* Fields grid */}
                    <div className="p-3 space-y-3">
                      {/* Stock + Cost */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isMultiSupplier ? 'Stock from supplier' : 'Supplier Stock'}
                            {isMultiSupplier && <span className="text-destructive ml-0.5">*</span>}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={stockEntry.stock === 0 ? '' : stockEntry.stock}
                            onChange={e => updateSupplierStock(sid, 'stock', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-10 text-sm font-medium"
                            readOnly={!isMultiSupplier}
                            disabled={!isMultiSupplier}
                          />
                          {!isMultiSupplier && (
                            <p className="text-[10px] text-muted-foreground leading-snug">Edit in Stock section above</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier Cost</Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">Rs.</span>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0.00"
                              value={stockEntry.cost === 0 ? '' : stockEntry.cost}
                              onChange={e => updateSupplierStock(sid, 'cost', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="h-10 text-sm font-medium pl-9"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SKU + Reorder */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            SKU <span className="font-normal normal-case opacity-50">(opt.)</span>
                          </Label>
                          <Input
                            type="text"
                            placeholder="e.g. SUP-001"
                            value={stockEntry.supplierSku ?? ''}
                            onChange={e => updateSupplierStock(sid, 'supplierSku', e.target.value)}
                            className="h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Reorder <span className="font-normal normal-case opacity-50">(opt.)</span>
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 10"
                            value={stockEntry.reorderLevel == null ? '' : stockEntry.reorderLevel}
                            onChange={e => updateSupplierStock(sid, 'reorderLevel', e.target.value === '' ? undefined : Number(e.target.value))}
                            className="h-10 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
});

SupplierSection.displayName = 'SupplierSection';
