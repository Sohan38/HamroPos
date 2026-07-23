import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { SectionProps } from './types';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface PricingSectionProps extends SectionProps {
  hasExpiry: boolean;
  averagePurchaseRate: number;
}

export const PricingSection = React.memo(({ form, hasExpiry, averagePurchaseRate }: PricingSectionProps) => {
  const sellingRate  = useWatch({ control: form.control, name: 'sellingRate'  }) ?? 0;
  const purchaseRate = useWatch({ control: form.control, name: 'purchaseRate' }) ?? 0;

  const effectivePurchase = hasExpiry ? averagePurchaseRate : purchaseRate;
  const profitPerUnit = sellingRate - effectivePurchase;
  const profitMargin  = sellingRate > 0
    ? Math.round((profitPerUnit / sellingRate) * 100)
    : 0;

  const sellingError  = form.formState.errors.sellingRate?.message;
  const purchaseError = form.formState.errors.purchaseRate?.message;

  const sellingValid  = !sellingError  && sellingRate  > 0;
  const purchaseValid = !purchaseError && purchaseRate >= 0;

  const isProfit = profitPerUnit >= 0;

  return (
    <section className="px-4 py-4 space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pricing</p>

      {hasExpiry ? (
        <div className="space-y-2">
          {/* Selling price only (purchase cost comes from batches) */}
          <FormField control={form.control} name="sellingRate" render={({ field }) => (
            <FormItem>
              <FormLabel>Selling Price (MRP) *</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0.01}
                    placeholder="0.00"
                    {...field}
                    value={field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={cn(
                      'pl-10 transition-all',
                      sellingError  && 'border-destructive focus-visible:ring-destructive/30',
                      sellingValid  && 'border-green-400 focus-visible:ring-green-400/30'
                    )}
                  />
                  {sellingValid && (
                    <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500 pointer-events-none" />
                  )}
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />

          {averagePurchaseRate > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Avg. purchase cost (from batches)</span>
              <span className="font-semibold">Rs. {averagePurchaseRate.toFixed(2)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Purchase cost */}
          <FormField control={form.control} name="purchaseRate" render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Cost <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    {...field}
                    value={field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={cn(
                      'pl-10 transition-all',
                      purchaseError  && 'border-destructive focus-visible:ring-destructive/30',
                      purchaseValid && purchaseRate > 0 && 'border-green-400 focus-visible:ring-green-400/30'
                    )}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />

          {/* Selling price */}
          <FormField control={form.control} name="sellingRate" render={({ field }) => (
            <FormItem>
              <FormLabel>Selling Price (MRP) *</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Rs.</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0.01}
                    placeholder="0.00"
                    {...field}
                    value={field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={cn(
                      'pl-10 transition-all',
                      sellingError  && 'border-destructive focus-visible:ring-destructive/30',
                      sellingValid  && 'border-green-400 focus-visible:ring-green-400/30'
                    )}
                  />
                  {sellingValid && (
                    <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500 pointer-events-none" />
                  )}
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />
        </div>
      )}

      {/* Live profit indicator — only shows when selling price is set */}
      {sellingRate > 0 && (
        <div className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all',
          isProfit
            ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
            : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
        )}>
          <div className="flex items-center gap-2">
            {isProfit
              ? <TrendingUp  className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
            <span className="font-medium">Profit per unit</span>
          </div>
          <div className="text-right leading-tight">
            <span className={cn('font-bold tabular-nums', isProfit ? 'text-green-700' : 'text-destructive')}>
              {isProfit ? '+' : ''}{profitPerUnit.toFixed(2)}
            </span>
            {effectivePurchase > 0 && (
              <span className="text-xs text-muted-foreground ml-1.5">({profitMargin}%)</span>
            )}
          </div>
        </div>
      )}

      {/* Gentle warning when selling below cost — not an error, just a nudge */}
      {sellingRate > 0 && effectivePurchase > 0 && !isProfit && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5 -mt-1">
          <span>⚠️</span>
          Selling below cost — you'll lose money on each sale. You can still save.
        </p>
      )}
    </section>
  );
});

PricingSection.displayName = 'PricingSection';
