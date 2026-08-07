import React, { useCallback, useMemo } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Camera, CheckCircle2, X } from 'lucide-react';
import { SectionProps } from './types';
import { toast } from 'sonner';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { rankSearch } from '@/utils/search/rank';

interface ProductIdentitySectionProps extends SectionProps {
  isNew: boolean;
  existingCategories: string[];
  existingBrands: string[];
}

export const ProductIdentitySection = React.memo(({ form, isNew, existingCategories, existingBrands }: ProductIdentitySectionProps) => {
  const imageBase64   = useWatch({ control: form.control, name: 'imageBase64' }) ?? '';
  const nameValue     = useWatch({ control: form.control, name: 'name' })        ?? '';
  const categoryValue = useWatch({ control: form.control, name: 'category' })   ?? '';
  const brandValue    = useWatch({ control: form.control, name: 'brand' })      ?? '';

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => form.setValue('imageBase64', reader.result as string);
    reader.readAsDataURL(file);
  }, [form]);

  const nameError     = form.formState.errors.name?.message;
  const categoryError = form.formState.errors.category?.message;
  const nameOk        = !nameError && nameValue.length >= 2;
  const categoryOk    = !categoryError && categoryValue.length > 0;

  // Optimize searches: compute ranked results only when input query changes, preventing excessive re-runs
  const filteredCategories = useMemo(() => {
    const query = categoryValue.trim();
    if (!query) return existingCategories.slice(0, 12);
    return rankSearch(existingCategories.map(cat => ({ name: cat })), query, 12).map(i => i.name);
  }, [categoryValue, existingCategories]);

  const filteredBrands = useMemo(() => {
    const query = brandValue.trim();
    if (!query) return existingBrands.slice(0, 8);
    return rankSearch(existingBrands.map(b => ({ name: b })), query, 8).map(i => i.name);
  }, [brandValue, existingBrands]);

  return (
    <section className="px-4 py-5 space-y-4">
      {/* Image + Name row */}
      <div className="flex items-start gap-3">
        {/* Image well */}
        <div
          className={cn(
            'relative w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all shrink-0 mt-5 active:scale-95',
            imageBase64
              ? 'border-primary/40 shadow-sm'
              : 'border-muted-foreground/25 bg-muted/40 hover:border-primary/50 hover:bg-primary/5'
          )}
          onClick={() => document.getElementById('image-upload')?.click()}
        >
          {imageBase64 ? (
            <>
              <img src={imageBase64} alt="Product" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </>
          ) : (
            <Camera className="h-6 w-6 text-muted-foreground/50" />
          )}
          <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between mb-1">
                <FormLabel className="mb-0 text-sm font-semibold">Product Name *</FormLabel>
                <span className={cn('text-[10px] tabular-nums', nameValue.length > 90 ? 'text-destructive' : 'text-muted-foreground')}>
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
                      'pr-8 transition-colors',
                      nameError && 'border-destructive focus-visible:ring-destructive/30',
                      nameOk    && 'border-green-400 focus-visible:ring-green-400/30'
                    )}
                  />
                  {nameOk && <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500 pointer-events-none" />}
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Remove image */}
      {imageBase64 && (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive ml-[76px] -mt-2 transition-colors"
          onClick={() => form.setValue('imageBase64', '')}
        >
          <X className="h-3 w-3" /> Remove photo
        </button>
      )}

      {/* Category */}
      <FormField control={form.control} name="category" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1">
            <FormLabel className="mb-0 text-sm font-semibold">Category *</FormLabel>
            {categoryOk && (
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
                'transition-colors',
                categoryError && 'border-destructive focus-visible:ring-destructive/30',
                categoryOk    && 'border-green-400 focus-visible:ring-green-400/30'
              )}
            />
          </FormControl>
          {filteredCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
              {filteredCategories.map((cat: string) => (
                <button
                  key={cat}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    form.setValue('category', cat, { shouldTouch: true });
                    form.clearErrors('category');
                    form.trigger('category');
                  }}
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full border shrink-0 font-medium transition-all',
                    field.value === cat
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <FormMessage className="text-xs" />
        </FormItem>
      )} />

      {/* Barcode (Full Line) */}
      <FormField control={form.control} name="barcode" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barcode <span className="font-normal normal-case tracking-normal opacity-60 ml-1">(opt.)</span></FormLabel>
          <div className="flex items-center gap-1.5">
            <FormControl>
              <Input placeholder="Scan or type barcode" {...field} className="h-9" />
            </FormControl>
            <BarcodeScanner
              className="h-9 w-9 shrink-0"
              onScan={(code) => form.setValue('barcode', code, { shouldValidate: true })}
            />
          </div>
          <FormMessage className="text-xs" />
        </FormItem>
      )} />

      {/* Brand (Full Line) */}
      <FormField control={form.control} name="brand" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand <span className="font-normal normal-case tracking-normal opacity-60 ml-1">(opt.)</span></FormLabel>
          <FormControl>
            <Input placeholder="e.g. Coca-Cola" {...field} className="h-9" />
          </FormControl>
          {filteredBrands.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
              {filteredBrands.map((b: string) => (
                <button
                  key={b}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    form.setValue('brand', b, { shouldTouch: true });
                    form.clearErrors('brand');
                    form.trigger('brand');
                  }}
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full border shrink-0 font-medium transition-all',
                    field.value === b
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
          <FormMessage className="text-xs" />
        </FormItem>
      )} />
    </section>
  );
});

ProductIdentitySection.displayName = 'ProductIdentitySection';
