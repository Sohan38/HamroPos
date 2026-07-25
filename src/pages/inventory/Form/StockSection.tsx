import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionProps } from './types';
import { ProductUnit } from '@/types';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';

const UNITS: ProductUnit[] = ['pcs', 'packet', 'box', 'bottle', 'kg', 'gram', 'litre', 'ml', 'plate', 'cup', 'glass', 'meter', 'roll', 'dozen', 'custom'];

interface StockSectionProps extends SectionProps {
  hasExpiry: boolean;
  hasVariants: boolean;
  totalBatchQuantity: number;
  totalVariantQuantity: number;
  isMultiSupplier?: boolean;
  totalSupplierStockQuantity?: number;
}

// Reusable numeric field with zero-clear and green valid state
const NumericField = ({
  form,
  name,
  label,
  hint,
  required = false,
}: {
  form: StockSectionProps['form'];
  name: 'quantity' | 'minimumStock';
  label: string;
  hint?: string;
  required?: boolean;
}) => {
  const value = useWatch({ control: form.control, name }) ?? 0;
  const error = form.formState.errors[name]?.message;
  const isTouched = form.formState.touchedFields[name];
  const isValid = isTouched && !error;

  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>
          {label}{required && ' *'}
          {!required && <span className="text-muted-foreground font-normal text-[10px] ml-1">(optional)</span>}
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
              'transition-all',
              error && 'border-destructive focus-visible:ring-destructive/30',
              isValid && 'border-green-400 focus-visible:ring-green-400/30'
            )}
          />
        </FormControl>
        {hint && !error && (
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        )}
        <FormMessage className="text-xs" />
      </FormItem>
    )} />
  );
};

export const StockSection = React.memo(({ form, hasExpiry, hasVariants, totalBatchQuantity, totalVariantQuantity, isMultiSupplier, totalSupplierStockQuantity }: StockSectionProps) => {
  const watchedUnit = useWatch({ control: form.control, name: 'unit' }) || 'pcs';

  return (
    <section className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stock &amp; Unit</p>

        {/* Unit Selector */}
        <div className="w-[120px]">
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {hasExpiry ? (
        // Expiry/batch mode — stock is driven by batches
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Total stock (from batches)</span>
            <span className="font-semibold">
              {totalBatchQuantity} <span className="text-muted-foreground font-normal">{watchedUnit}</span>
            </span>
          </div>
          <NumericField
            form={form}
            name="minimumStock"
            label="Low Stock Alert"
            hint={`Notify when stock drops to or below this number of ${watchedUnit}.`}
          />
        </div>

      ) : hasVariants ? (
        // Variants mode — stock summed from variant rows
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Total stock (from variants)</span>
            <span className="font-semibold">
              {totalVariantQuantity} <span className="text-muted-foreground font-normal">{watchedUnit}</span>
            </span>
          </div>
          <NumericField
            form={form}
            name="minimumStock"
            label="Low Stock Alert"
            hint="Alert when total variant stock hits this level."
          />
        </div>

      ) : isMultiSupplier ? (
        // Multi-supplier mode — stock summed from supplier entries (read-only here)
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-blue-700">Total stock (from all suppliers)</span>
            <span className="font-semibold text-blue-900">
              {totalSupplierStockQuantity ?? 0} <span className="font-normal text-blue-600">{watchedUnit}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            Edit stock in the Suppliers section above — each supplier maintains its own stock level.
          </p>
          <NumericField
            form={form}
            name="minimumStock"
            label="Low Stock Alert"
            hint={`Notify when total stock drops to or below this number of ${watchedUnit}.`}
          />
        </div>

      ) : (
        // Normal single-supplier mode
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            form={form}
            name="quantity"
            label="Current Stock"
            hint={`How many ${watchedUnit} do you have right now?`}
          />
          <NumericField
            form={form}
            name="minimumStock"
            label="Low Stock Alert"
            hint="We'll warn you when stock falls here."
          />
        </div>
      )}
    </section>
  );
});

StockSection.displayName = 'StockSection';
