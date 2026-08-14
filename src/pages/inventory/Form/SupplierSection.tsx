import React, { useCallback, useEffect, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionProps } from './types';
import { Supplier } from '@/types';
import { Plus, X, Truck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupplierSearchList } from '@/components/SupplierSearchList';
import { generateSupplierInvoiceNumber } from '@/utils/numbering';
import { useLocations } from '@/contexts/GlobalProviders';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SupplierSectionProps extends SectionProps {
  isNew: boolean;
  suppliers: Supplier[];
  existingPurchases?: Array<{ invoiceNumber?: string | null; date?: string | null }>;
  onSupplierNew: (name?: string) => void;
}

export const SupplierSection = React.memo(({ form, isNew, suppliers, existingPurchases = [], onSupplierNew }: SupplierSectionProps) => {
  const selectedSupplierIds: string[] = useWatch({ control: form.control, name: 'supplierIds' }) ?? [];
  const supplierStocks: any[] = useWatch({ control: form.control, name: 'supplierStocks' }) ?? [];
  const { items: locations } = useLocations();
  const isMultiSupplier = selectedSupplierIds.length >= 2;
  const locationOptions = locations.length > 0 ? locations : [{ id: 'loc-default', name: 'Main Location' }];

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const addSupplier = useCallback((sid: string) => {
    const next = [...selectedSupplierIds, sid];
    form.setValue('supplierIds', next, { shouldDirty: true });

    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    const currentPurchaseRate = Number(form.getValues('purchaseRate') ?? 0);
    const isFirst = next.length === 1;
    const globalStock = isFirst ? (form.getValues('quantity') ?? 0) : 0;
    const defaultLocationId = 'loc-default';

    if (!currentStocks.some((ss: any) => ss.supplierId === sid && (ss.locationId || defaultLocationId) === defaultLocationId)) {
      form.setValue('supplierStocks', [
        ...currentStocks,
        {
          supplierId: sid,
          locationId: defaultLocationId,
          cost: currentPurchaseRate > 0 ? currentPurchaseRate : 0,
          stock: globalStock,
          supplierSku: '',
          reorderLevel: undefined,
          notes: ''
        },
      ], { shouldDirty: true });
    }
  }, [selectedSupplierIds, form]);

  const removeSupplier = useCallback((sid: string) => {
    const next = selectedSupplierIds.filter(s => s !== sid);
    form.setValue('supplierIds', next, { shouldDirty: true });
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    form.setValue('supplierStocks', currentStocks.filter((ss: any) => !(ss.supplierId === sid && (ss.locationId || 'loc-default') === 'loc-default')), { shouldDirty: true });
  }, [selectedSupplierIds, form]);

  const updateSupplierStock = useCallback((supplierId: string, field: string, value: string | number | undefined, currentLocationId = 'loc-default') => {
    const currentStocks: any[] = form.getValues('supplierStocks') ?? [];
    if (field === 'locationId') {
      const currentRecord = currentStocks.find((ss: any) => ss.supplierId === supplierId && (ss.locationId || 'loc-default') === currentLocationId)
        ?? { supplierId, locationId: currentLocationId, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined, notes: '' };
      const nextStocks = currentStocks.filter((ss: any) => !(ss.supplierId === supplierId && (ss.locationId || 'loc-default') === currentLocationId));
      form.setValue('supplierStocks', [...nextStocks, { ...currentRecord, supplierId, locationId: String(value) }], { shouldDirty: true });
      return;
    }

    form.setValue('supplierStocks', currentStocks.map((ss: any) =>
      ss.supplierId === supplierId && (ss.locationId || 'loc-default') === currentLocationId ? { ...ss, [field]: value } : ss
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
        {isNew && (<Button
          type="button" variant="ghost" size="sm"
          className="h-8 text-xs gap-1.5 text-primary rounded-xl hover:bg-primary/10"
          onClick={() => onSupplierNew()}
        >
          <Plus className="h-3.5 w-3.5" /> New Supplier
        </Button>
        )}
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
          {isNew && (<SupplierSearchList
            suppliers={suppliers}
            selectedSupplierIds={selectedSupplierIds}
            onSelect={addSupplier}
            onAddNew={onSupplierNew}
            placeholder="Type to filter suppliers..."
            emptyMessage="No more suppliers to add."
            label="Suppliers"
            maxVisible={8}
          />
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
                const stockEntry = supplierStocks.find((ss: any) => ss.supplierId === sid && (ss.locationId || 'loc-default') === 'loc-default')
                  ?? { supplierId: sid, locationId: 'loc-default', cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined };

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
                      {isNew && (<button
                        type="button"
                        className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeSupplier(sid)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="p-3 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location</Label>
                        <Select
                          value={stockEntry.locationId || 'loc-default'}
                          onValueChange={(nextLocationId) => updateSupplierStock(sid, 'locationId', nextLocationId, stockEntry.locationId || 'loc-default')}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder="Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locationOptions.map((location: any) => (
                              <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

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
                            readOnly={!isNew || !isMultiSupplier}
                            disabled={!isNew || !isMultiSupplier}
                          />
                          {(!isNew || !isMultiSupplier) && (
                            <p className="text-[10px] text-muted-foreground">
                              {isNew ? 'Edit stock in the Stock section above' : 'Use stock adjustments for existing products.'}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cost (Rs.)</Label>
                          <Input
                            type="number" min={0} placeholder="0.00"
                            value={stockEntry.cost === 0 ? '' : stockEntry.cost}
                            onChange={e => updateSupplierStock(sid, 'cost', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="h-10 text-sm font-medium"
                            readOnly={!isNew}
                            disabled={!isNew}
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
