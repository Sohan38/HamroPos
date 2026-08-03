import React, { useCallback } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ImagePlus, CheckCircle2, X } from 'lucide-react';
import { SectionProps } from './types';
import { toast } from 'sonner';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { BarcodeScanner } from '@/components/BarcodeScanner';

interface ProductIdentitySectionProps extends SectionProps {
  isNew: boolean;
  existingCategories: string[];
}

// Reusable field status indicator
const FieldStatus = ({ value, error, minLen = 0 }: { value: string; error?: string; minLen?: number }) => {
  if (!value) return null;
  const isValid = !error && value.length >= minLen;
  if (isValid) return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  return null;
};

export const ProductIdentitySection = React.memo(({ form, isNew, existingCategories }: ProductIdentitySectionProps) => {
  const imageBase64 = useWatch({ control: form.control, name: 'imageBase64' }) ?? '';
  const nameValue = useWatch({ control: form.control, name: 'name' }) ?? '';
  const categoryValue = useWatch({ control: form.control, name: 'category' }) ?? '';

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => form.setValue('imageBase64', reader.result as string);
    reader.readAsDataURL(file);
  }, [form]);

  const nameError = form.formState.errors.name?.message;
  const categoryError = form.formState.errors.category?.message;

  return (
    <section className="px-4 py-4 space-y-3">
      {/* Image Upload + Name row */}
      <div className="flex items-start gap-3">
        {/* Image thumbnail */}
        <div
          className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/40 overflow-hidden cursor-pointer hover:bg-muted/70 active:scale-95 transition-all shrink-0 mt-5 relative group"
          onClick={() => document.getElementById('image-upload')?.click()}
        >
          {imageBase64 ? (
            <>
              <img src={imageBase64} alt="Product" className="w-full h-full object-cover" />
              {/* Overlay remove on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <X className="h-4 w-4 text-white" />
              </div>
            </>
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* Name field */}
        <div className="flex-1 min-w-0">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between mb-1.5">
                <FormLabel className="mb-0">Product Name *</FormLabel>
                <span className={cn(
                  'text-[10px] tabular-nums transition-colors',
                  nameValue.length > 90 ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {nameValue.length}/100
                </span>
              </div>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="e.g. Coca-Cola 500ml"
                    autoFocus={isNew}
                    {...field}
                    className={cn(
                      'pr-8 transition-all',
                      nameError && 'border-destructive focus-visible:ring-destructive/30',
                      !nameError && nameValue.length >= 2 && 'border-green-400 focus-visible:ring-green-400/30'
                    )}
                  />
                  {!nameError && nameValue.length >= 2 && (
                    <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500 pointer-events-none" />
                  )}
                </div>
              </FormControl>
              <FormMessage className="text-xs mt-1" />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Remove image link */}
      {imageBase64 && (
        <button
          type="button"
          className="text-xs text-destructive ml-[68px] -mt-1 hover:underline"
          onClick={() => form.setValue('imageBase64', '')}
        >
          Remove image
        </button>
      )}

      {/* Category */}
      <FormField control={form.control} name="category" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1.5">
            <FormLabel className="mb-0">Category *</FormLabel>
            {!categoryError && categoryValue.length > 0 && (
              <span className="text-[10px] text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Set
              </span>
            )}
          </div>
          <FormControl>
            <Input
              placeholder="e.g. Beverages"
              {...field}
              className={cn(
                'transition-all',
                categoryError && 'border-destructive focus-visible:ring-destructive/30',
                !categoryError && categoryValue.length > 0 && 'border-green-400 focus-visible:ring-green-400/30'
              )}
            />
          </FormControl>
          {/* Category pill suggestions */}
          {existingCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
              {existingCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    form.setValue('category', cat, { shouldValidate: true, shouldTouch: true });
                  }}
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full border shrink-0 font-medium transition-all',
                    field.value === cat
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted hover:border-muted-foreground/40'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <FormMessage className="text-xs mt-0.5" />
        </FormItem>
      )} />

      {/* Barcode + Brand */}
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="barcode" render={({ field }) => (
          <FormItem>
            <FormLabel>Barcode <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
            <div className="flex items-center gap-1.5">
              <FormControl>
                <Input placeholder="Scan or type" {...field} />
              </FormControl>
              <BarcodeScanner
                className="h-9 w-9"
                onScan={(code) => form.setValue('barcode', code, { shouldValidate: true })}
              />
            </div>
            <FormMessage className="text-xs" />
          </FormItem>
        )} />

        <FormField control={form.control} name="brand" render={({ field }) => (
          <FormItem>
            <FormLabel>Brand <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
            <FormControl>
              <Input placeholder="e.g. Coca-Cola" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )} />
      </div>
    </section>
  );
});

ProductIdentitySection.displayName = 'ProductIdentitySection';
