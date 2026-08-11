import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionProps } from './types';
import { ProductUnit } from '@/types';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Package, AlertTriangle } from 'lucide-react';

const UNITS: ProductUnit[] = ['pcs', 'packet', 'box', 'bottle', 'kg', 'gram', 'litre', 'ml', 'plate', 'cup', 'glass', 'meter', 'roll', 'dozen', 'custom'];

interface StockSectionProps extends SectionProps {
  isNew: boolean;
  hasExpiry: boolean;
  hasVariants: boolean;
  totalBatchQuantity: number;
  totalVariantQuantity: number;
  isMultiSupplier?: boolean;
  totalSupplierStockQuantity?: number;
}

// Reusable numeric field
const NumericField = ({
  form,
  name,
  label,
  hint,
  required = false,
  readOnly = false,
}: {
  form: StockSectionProps['form'];
  name: 'quantity' | 'minimumStock';
  label: string;
  hint?: string;
  required?: boolean;
  readOnly?: boolean;
}) => {
  const value = useWatch({ control: form.control, name }) ?? 0;
  const error = form.formState.errors[name]?.message;
  const touched = form.formState.touchedFields[name];
  const isValid = touched && !error;

  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}{required && ' *'}
          {!required && <span className="font-normal normal-case tracking-normal opacity-60 ml-1">(opt.)</span>}
        </FormLabel>
        <FormControl>
          <Input
            type="number"
            min={0}
            placeholder="0"
            {...field}
            value={field.value === 0 ? '' : field.value}
            onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            className={cn(
              'transition-colors h-11 text-base font-medium',
              error && 'border-destructive focus-visible:ring-destructive/30',
              isValid && 'border-green-400 focus-visible:ring-green-400/30'
            )}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </FormControl>
        {hint && !error && <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{hint}</p>}
        <FormMessage className="text-xs" />
      </FormItem>
    )} />
  );
};

export const StockSection = React.memo(({
  form, isNew, hasExpiry, hasVariants,
  totalBatchQuantity, totalVariantQuantity,
  isMultiSupplier, totalSupplierStockQuantity,
}: StockSectionProps) => {
  const watchedUnit = useWatch({ control: form.control, name: 'unit' }) || 'pcs';

  // Summary chip used in managed-stock modes
  const SummaryChip = ({ label, qty, accent = false }: { label: string; qty: number; accent?: boolean }) => (
    <div className={cn(
      'flex items-center justify-between rounded-2xl px-4 py-3 border',
      accent
        ? 'bg-primary/5 border-primary/20'
        : 'bg-muted/40 border-border'
    )}>
      <div className="flex items-center gap-2">
        <Package className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        <span className={cn('text-sm', accent ? 'text-primary font-medium' : 'text-muted-foreground')}>{label}</span>
      </div>
      <span className={cn('text-lg font-bold tabular-nums', accent ? 'text-primary' : 'text-foreground')}>
        {qty} <span className="text-sm font-normal text-muted-foreground">{watchedUnit}</span>
      </span>
    </div>
  );

  return (
    <section className="px-4 py-4 space-y-4">
      {/* Header row: label + unit selector */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stock & Unit</p>
        <div className="w-29">
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-8 text-xs rounded-xl">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {hasExpiry ? (
        <div className="space-y-3">
          <SummaryChip label="Total stock (from batches)" qty={totalBatchQuantity} />
          <NumericField form={form} name="minimumStock" label="Low Stock Alert"
            hint={`Alert when stock ≤ this number of ${watchedUnit}`} />
        </div>

      ) : hasVariants ? (
        <div className="space-y-3">
          <SummaryChip label="Total stock (from variants)" qty={totalVariantQuantity} />
          <NumericField form={form} name="minimumStock" label="Low Stock Alert"
            hint="Alert when total variant stock hits this level." />
        </div>

      ) : isMultiSupplier ? (
        <div className="space-y-3">
          <SummaryChip label="Total stock (from all suppliers)" qty={totalSupplierStockQuantity ?? 0} accent />
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
            Edit individual stock in the Suppliers section below.
          </p>
          <NumericField form={form} name="minimumStock" label="Low Stock Alert"
            hint={`Alert when total stock ≤ this number of ${watchedUnit}`} />
        </div>

      ) : (
        // Normal single-supplier / no supplier mode
        <div className="grid grid-cols-2 gap-3">
          <NumericField form={form} name="quantity" label="Current Stock"
            hint={isNew ? `How many ${watchedUnit} in stock?` : `Stock is managed through stock adjustments for existing products.`}
            readOnly={!isNew}
          />
          <NumericField form={form} name="minimumStock" label="Low Stock Alert"
            hint={`Alert below this qty of ${watchedUnit}.`} />
        </div>
      )}
    </section>
  );
});

StockSection.displayName = 'StockSection';
