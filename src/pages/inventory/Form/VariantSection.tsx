import React, { useCallback, memo } from 'react';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { SectionProps, ProductFormValues } from './types';

// ─── Single row — memoized so sibling edits don't re-render unrelated rows ────
interface VariantRowProps {
  index: number;
  fieldId: string; // stable id from useFieldArray
  form: UseFormReturn<ProductFormValues>;
  onRemove: (index: number) => void;
}

const VariantRow = memo(({ index, fieldId, form, onRemove }: VariantRowProps) => {
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div key={fieldId} className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-muted/40">
      <FormField
        control={form.control}
        name={`variants.${index}.name`}
        render={({ field }) => (
          <FormItem className="flex-1 space-y-0">
            <Input
              placeholder="e.g. Red, Medium, XL"
              {...field}
              className="h-9 bg-background"
            />
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
              className="h-9 bg-background"
              // Clear leading zero: show blank when 0, parse on change
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
        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
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
  // useFieldArray: only re-renders when the array itself changes, not on
  // sibling field changes. append/remove have stable references.
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'variants',
  });

  const handleAdd = useCallback(() => {
    append({ name: '', quantity: 0 });
  }, [append]);

  // stable callback passed to every VariantRow
  const handleRemove = useCallback((index: number) => {
    remove(index);
  }, [remove]);

  if (!isVariantsEnabled) return null;

  return (
    <section className="px-4 py-4 space-y-4">
      <FormField control={form.control} name="hasVariants" render={({ field }) => (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${hasVariants ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Product Variants</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {hasVariants
                  ? 'Stock options like sizes, colors'
                  : 'Enable to specify different sizes or colors'}
              </p>
            </div>
          </div>
          <Switch
            checked={field.value ?? false}
            onCheckedChange={(checked) => {
              field.onChange(checked);
              onToggleVariants(checked);
            }}
            className="shrink-0"
          />
        </div>
      )} />

      {hasVariants && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variants List</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleAdd}
            >
              <Plus className="h-3.5 w-3.5" /> Add Variant
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg bg-muted/10">
              No variants defined. Add one above.
            </p>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
