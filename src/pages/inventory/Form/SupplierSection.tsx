import React, { useCallback, useEffect, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SectionProps } from './types';
import { Supplier } from '@/types';
import { Plus, X, Truck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rankSearch } from '@/utils/search/rank';
import { generateSupplierInvoiceNumber } from '@/utils/numbering';

interface SupplierSectionProps extends SectionProps {
  suppliers: Supplier[];
  existingPurchases?: Array<{ invoiceNumber?: string | null; date?: string | null }>;
  onSupplierNew: (name?: string) => void;
}

export const SupplierSection = React.memo(({ form, suppliers, existingPurchases = [], onSupplierNew }: SupplierSectionProps) => {
  const selectedSupplierIds: string[] = useWatch({ control: form.control, name: 'supplierIds' }) ?? [];
  const supplierStocks: any[] = useWatch({ control: form.control, name: 'supplierStocks' }) ?? [];
  const isMultiSupplier = selectedSupplierIds.length >= 2;

  // Watch the filter input value (we'll read it locally, no need to register in schema)
  const [filterQuery, setFilterQuery] = React.useState('');

  // Unselected suppliers filtered and ranked
  const selectableSuppliers = useMemo(() => {
    const unselected = suppliers.filter(s => !selectedSupplierIds.includes(s.id));
    if (!filterQuery.trim()) {
      return unselected.slice(0, 8); // Limit to 8 when not typing to prevent clogging
    }
    return rankSearch(unselected, filterQuery, 20); // Ranked search matches when typing
  }, [suppliers, selectedSupplierIds, filterQuery]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const addSupplier = useCallback((sid: string) => {
    const next = [...selectedSupplierIds, sid];
    form.setValue('supplierIds', next, { shouldDirty: true });

    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    const currentPurchaseRate = form.getValues('purchaseRate') ?? 0;
    const isFirst = next.length === 1;
    const globalStock = isFirst ? (form.getValues('quantity') ?? 0) : 0;

    if (!currentStocks.find((ss: any) => ss.supplierId === sid)) {
      form.setValue('supplierStocks', [
        ...currentStocks,
        { supplierId: sid, cost: currentPurchaseRate, stock: globalStock, supplierSku: '', reorderLevel: undefined, notes: '' },
      ], { shouldDirty: true });
    }

    setFilterQuery(''); // Clear query on selection
  }, [selectedSupplierIds, form]);

  const removeSupplier = useCallback((sid: string) => {
    const next = selectedSupplierIds.filter(s => s !== sid);
    form.setValue('supplierIds', next, { shouldDirty: true });
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    form.setValue('supplierStocks', currentStocks.filter((ss: any) => ss.supplierId !== sid), { shouldDirty: true });
  }, [selectedSupplierIds, form]);

  const updateSupplierStock = useCallback((supplierId: string, field: string, value: string | number | undefined) => {
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    form.setValue('supplierStocks', currentStocks.map((ss: any) =>
      ss.supplierId === supplierId ? { ...ss, [field]: value } : ss
    ), { shouldDirty: true });
  }, [form]);

  useEffect(() => {
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    let changed = false;
    const nextStocks = currentStocks.map((stock: any) => {
      if (!selectedSupplierIds.includes(stock.supplierId)) return stock;
      const supplier = suppliers.find(candidate => candidate.id === stock.supplierId);
      const currentValue = typeof stock.supplierSku === 'string' ? stock.supplierSku.trim() : '';
      if (currentValue) return stock;

      const generatedInvoice = generateSupplierInvoiceNumber(existingPurchases, supplier?.name, new Date());
      if (generatedInvoice !== currentValue) {
        changed = true;
        return { ...stock, supplierSku: generatedInvoice };
      }
      return stock;
    });

    if (changed) {
      form.setValue('supplierStocks', nextStocks, { shouldDirty: true });
    }
  }, [existingPurchases, form, selectedSupplierIds, suppliers]);

  return (
    <section className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suppliers</p>
          {selectedSupplierIds.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedSupplierIds.length}</Badge>
          )}
        </div>
        <Button
          type="button" variant="ghost" size="sm"
          className="h-8 text-xs gap-1.5 text-primary rounded-xl hover:bg-primary/10"
          onClick={() => onSupplierNew()}
        >
          <Plus className="h-3.5 w-3.5" /> New Supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-muted rounded-2xl bg-muted/10 cursor-pointer active:bg-muted/20 transition-colors"
          onClick={() => onSupplierNew()}
        >
          <Truck className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No suppliers yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Tap to create your first</p>
        </div>
      ) : (
        <>
          {/* Supplier Search Filter Input */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Type to filter suppliers..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Supplier selection chips (scroll-to-side on mobile, max 8 when not typing) */}
          {selectableSuppliers.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
              {selectableSuppliers.map(s => {
                const isInactive = (s.status ?? 'active') === 'inactive';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addSupplier(s.id)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all select-none active:scale-95 bg-muted/50 border-border text-foreground hover:border-primary/50 hover:bg-primary/5 shrink-0',
                      isInactive && 'opacity-40'
                    )}
                  >
                    <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    {s.name}
                    {isInactive && <span className="opacity-60">(off)</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fallback info/empty indicator */}
          {selectableSuppliers.length === 0 && filterQuery && (
            <div className="text-center py-4 border border-dashed rounded-2xl bg-muted/10 space-y-1">
              <p className="text-xs text-muted-foreground">No matching suppliers found.</p>
              <button
                type="button"
                onClick={() => onSupplierNew(filterQuery)}
                className="text-xs text-primary font-semibold hover:underline"
              >
                + Add "{filterQuery}" as new supplier
              </button>
            </div>
          )}

          {/* ── Multi-supplier info ───────────────────────────────────────── */}
          {isMultiSupplier && (
            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl px-3.5 py-3 text-xs text-blue-700 dark:text-blue-300">
              <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Multiple suppliers — enter each one's stock & cost below. Total stock is summed automatically.</span>
            </div>
          )}

          {/* ── Per-supplier cards ────────────────────────────────────────── */}
          {selectedSupplierIds.length > 0 && (
            <div className="space-y-3">
              {selectedSupplierIds.map((sid, idx) => {
                const supplier = suppliers.find(s => s.id === sid);
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
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeSupplier(sid)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Fields */}
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isMultiSupplier ? 'Stock from supplier' : 'Supplier Stock'}
                            {isMultiSupplier && <span className="text-destructive ml-0.5">*</span>}
                          </Label>
                          <Input
                            type="number" min={0} placeholder="0"
                            value={stockEntry.stock === 0 ? '' : stockEntry.stock}
                            onChange={e => updateSupplierStock(sid, 'stock', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-10 text-sm font-medium"
                            readOnly={!isMultiSupplier}
                            disabled={!isMultiSupplier}
                          />
                          {!isMultiSupplier && (
                            <p className="text-[10px] text-muted-foreground">Edit in Stock section above</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cost (Rs.)</Label>
                          <Input
                            type="number" min={0} placeholder="0.00"
                            value={stockEntry.cost === 0 ? '' : stockEntry.cost}
                            onChange={e => updateSupplierStock(sid, 'cost', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-10 text-sm font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Invoice <span className="font-normal normal-case opacity-50">(auto)</span>
                          </Label>
                          <Input
                            type="text" placeholder="Auto-generated invoice"
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
                            type="number" min={0} placeholder="e.g. 10"
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
