import React from 'react';
import { FormField } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FlaskConical, Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { SectionProps } from './types';
import { ProductBatch } from '@/types';
import { ExpiryBadge, getBatchStatus } from '@/components/BatchFormDialog';

interface BatchSectionProps extends SectionProps {
  isExpiryEnabled: boolean;
  isBatchesEnabled: boolean;
  hasExpiry: boolean;
  onToggleExpiry: (checked: boolean) => void;
  localBatches: ProductBatch[];
  onAddBatch: () => void;
  onEditBatch: (batch: ProductBatch) => void;
  onDeleteBatch: (id: string) => void;
}

export const BatchSection = React.memo(({
  form,
  isExpiryEnabled,
  isBatchesEnabled,
  hasExpiry,
  onToggleExpiry,
  localBatches,
  onAddBatch,
  onEditBatch,
  onDeleteBatch
}: BatchSectionProps) => {
  if (!isExpiryEnabled || !isBatchesEnabled) return null;

  const sortedBatches = [...localBatches].sort(
    (a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')
  );

  return (
    <section className="px-4 py-4 space-y-4">
      <FormField control={form.control} name="hasExpiry" render={({ field }) => (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${hasExpiry ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <FlaskConical className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Track Expiry &amp; Batches</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {hasExpiry
                  ? 'Stock, cost & supplier per batch'
                  : 'Enable for products with expiry dates'}
              </p>
            </div>
          </div>
          <Switch
            checked={field.value ?? false}
            onCheckedChange={(checked) => {
              field.onChange(checked);
              onToggleExpiry(checked);
            }}
            className="shrink-0"
          />
        </div>
      )} />

      {hasExpiry && (
        <>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1 pl-0.5">
            <Info className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
            Sold FEFO (earliest expiry first). Purchase cost is the weighted average across all batches.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batches List</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onAddBatch}
              >
                <Plus className="h-3.5 w-3.5" /> Add Batch
              </Button>
            </div>

            {sortedBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg bg-muted/10">
                No batches added yet. Add at least one batch to track expiry.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {sortedBatches.map(batch => (
                  <div key={batch.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-muted/50 text-sm gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{batch.batchNumber}</span>
                        {batch.expiryDate && (
                          <ExpiryBadge expiryDate={batch.expiryDate} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Stock: <strong className="text-foreground">{batch.quantity}</strong></span>
                        <span>Cost: <strong className="text-foreground">Rs. {batch.purchaseRate.toFixed(1)}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => onEditBatch(batch)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDeleteBatch(batch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
});

BatchSection.displayName = 'BatchSection';
