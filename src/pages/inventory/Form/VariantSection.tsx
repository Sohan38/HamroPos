import React, { useCallback, memo } from 'react';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { SectionProps, ProductFormValues } from './types';

// ─── Single row — memoized ────────────────────────────────────────────────────
interface VariantRowProps {
  index: number;
  fieldId: string;
  form: UseFormReturn<ProductFormValues>;
  onRemove: (index: number) => void;
}

const VariantRow = memo(({ index, fieldId, form, onRemove }: VariantRowProps) => {
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div key={fieldId} className="flex items-center gap-2 bg-muted/30 px-3 py-2.5 rounded-2xl border border-muted/50">
      <FormField
        control={form.control}
        name={`variants.${index}.name`}
        render={({ field }) => (
          <FormItem className="flex-1 space-y-0">
            <Input placeholder="e.g. Red, Medium, XL" {...field} className="h-9 bg-background text-sm border-muted/50" />
            <FormMessage className="text-xs pt-0.5" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`variants.${index}.quantity`}
        render={({ field }) => (
          <FormItem className="w-20 space-y-0">
            <Input
              type="number"
              placeholder="Qty"
              min={0}
              className="h-9 bg-background text-sm border-muted/50"
              value={field.value === 0 ? '' : field.value}
              onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            />
            <FormMessage className="text-xs pt-0.5" />
          </FormItem>
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-xl"
        onClick={handleRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});
VariantRow.displayName = 'VariantRow';

// ─── Section ──────────────────────────────────────────────────────────────────
interface VariantSectionProps extends SectionProps {
  isVariantsEnabled: boolean;
  hasVariants: boolean;
  onToggleVariants: (checked: boolean) => void;
}

export const VariantSection = React.memo(({
  form,
  isVariantsEnabled,
  hasVariants,
  onToggleVariants,
}: VariantSectionProps) => {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });

  const handleAdd = useCallback(() => append({ name: '', quantity: 0 }), [append]);
  const handleRemove = useCallback((index: number) => remove(index), [remove]);

  if (!isVariantsEnabled) return null;

  return (
    <section className="px-4 py-4 space-y-4">
      {/* Toggle card */}
      <FormField control={form.control} name="hasVariants" render={({ field }) => (
        <div
          className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-colors cursor-pointer ${hasVariants
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-muted/20'
            }`}
          onClick={() => {
            const next = !field.value;
            field.onChange(next);
            onToggleVariants(next);
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 transition-colors ${hasVariants ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Product Variants</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {hasVariants ? 'Different sizes, colors, etc.' : 'Enable for size or colour options'}
              </p>
            </div>
          </div>
          <Switch
            checked={field.value ?? false}
            onCheckedChange={(checked) => { field.onChange(checked); onToggleVariants(checked); }}
            className="shrink-0 pointer-events-none"
          />
        </div>
      )} />

      {hasVariants && (
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Variants
              {fields.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{fields.length}</Badge>
              )}
            </span>
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs rounded-xl" onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Variant
            </Button>
          </div>

          {/* Column headers */}
          {fields.length > 0 && (
            <div className="flex items-center gap-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex-1">Variant Name</span>
              <span className="w-20">Qty</span>
              <span className="w-9" />
            </div>
          )}

          {fields.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-7 border-2 border-dashed border-muted rounded-2xl bg-muted/10 cursor-pointer active:bg-muted/30 transition-colors"
              onClick={handleAdd}
            >
              <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No variants defined</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Tap to add a variant</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-55 overflow-y-auto pr-0.5">
              {fields.map((field, index) => (
                <VariantRow
                  key={field.id}
                  index={index}
                  fieldId={field.id}
                  form={form}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});

VariantSection.displayName = 'VariantSection';
