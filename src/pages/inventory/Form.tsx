import { useEffect, useMemo, useState, useCallback } from 'react';
import { useWatch, useForm } from 'react-hook-form';
import { useLocation, useParams } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { useInventory, useSuppliers, useProductBatches } from '@/contexts/GlobalProviders';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import { ProductUnit, ProductBatch, BatchFormData } from '@/types';
import { toast } from 'sonner';
import { BatchFormDialog, getBatchStatus } from '@/components/BatchFormDialog';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useFeature } from '@/hooks/useFeature';

// Subcomponents
import { productSchema, ProductFormValues } from './Form/types';
import { ProductIdentitySection } from './Form/ProductIdentitySection';
import { PricingSection } from './Form/PricingSection';
import { StockSection } from './Form/StockSection';
import { SupplierSection } from './Form/SupplierSection';
import { VariantSection } from './Form/VariantSection';
import { BatchSection } from './Form/BatchSection';
import { NotesSection } from './Form/NotesSection';
import { SaveBar } from './Form/SaveBar';

export default function InventoryForm() {
  const isBatchesEnabled = useFeature('inventory', 'batches');
  const isExpiryEnabled = useFeature('inventory', 'expiry');
  const isVariantsEnabled = useFeature('inventory', 'variants');
  const goBack = useSmartBack('/inventory');
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { items, add, update } = useInventory();
  const { items: suppliers } = useSuppliers();
  const { items: allBatches, add: addBatch, update: updateBatch, hardRemove: removeBatch } = useProductBatches();

  const isNew = !id || id === 'new';
  const existingProduct = !isNew ? items.find(i => i.id === id) : null;

  // Local batch list (saved to store on product save)
  const [localBatches, setLocalBatches] = useState<ProductBatch[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);

  // Populate local batches from storage when editing
  useEffect(() => {
    if (!isNew && existingProduct) {
      setLocalBatches(allBatches.filter(b => b.productId === existingProduct.id));
    }
  }, [allBatches, existingProduct, isNew]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onTouched',         // show errors only after user touches a field
    reValidateMode: 'onChange', // re-validate live after first error is shown
    defaultValues: existingProduct ? {
      ...existingProduct,
      supplierIds: existingProduct.supplierIds ?? (existingProduct.supplierId ? [existingProduct.supplierId] : []),
      hasExpiry: existingProduct.hasExpiry ?? false,
      hasVariants: existingProduct.hasVariants ?? false,
      variants: existingProduct.variants ?? [],
      brand: existingProduct.brand ?? '',
      notes: existingProduct.notes ?? '',
      imageBase64: existingProduct.imageBase64 ?? '',
    } : {
      name: '', barcode: '', category: '', brand: '',
      supplierIds: [], unit: 'pcs',
      quantity: 0, minimumStock: 5,
      purchaseRate: 0, sellingRate: 0,
      hasExpiry: false, hasVariants: false,
      variants: [], notes: '', imageBase64: '',
    },
  });

  // Targeted watches — each only re-renders when that specific field changes
  const rawHasExpiry  = useWatch({ control: form.control, name: 'hasExpiry' });
  const rawHasVariants = useWatch({ control: form.control, name: 'hasVariants' });
  const watchedVariants = useWatch({ control: form.control, name: 'variants' }) || [];
  const purchaseRateWatch = useWatch({ control: form.control, name: 'purchaseRate' });
  const sellingRateWatch  = useWatch({ control: form.control, name: 'sellingRate' });
  const quantityWatch     = useWatch({ control: form.control, name: 'quantity' });
  const minimumStockWatch = useWatch({ control: form.control, name: 'minimumStock' });

  const hasExpiry   = (isExpiryEnabled && isBatchesEnabled) ? (rawHasExpiry  ?? false) : false;
  const hasVariants = isVariantsEnabled                     ? (rawHasVariants ?? false) : false;

  // Generate unique categories list with pre-defined fallbacks
  const existingCategories = useMemo(() => {
    const cats = new Set<string>([
      'Beverages', 'Snacks', 'Groceries', 'Bakery', 'Electronics', 'Services'
    ]);
    for (const item of items) {
      if (item.category) cats.add(item.category.trim());
    }
    return Array.from(cats).sort().slice(0, 12);
  }, [items]);

  // Compute average purchase cost dynamically
  const averagePurchaseRate = useMemo(() => {
    if (!hasExpiry || localBatches.length === 0) return purchaseRateWatch || 0;
    const totalQty = localBatches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalQty === 0) return 0;
    const totalCost = localBatches.reduce((sum, b) => sum + b.purchaseRate * b.quantity, 0);
    return totalCost / totalQty;
  }, [hasExpiry, localBatches, purchaseRateWatch]);

  // Real-time stock / quantity calculations
  const totalBatchQuantity = useMemo(() => {
    return localBatches.reduce((sum, b) => sum + b.quantity, 0);
  }, [localBatches]);

  const totalVariantQuantity = useMemo(() => {
    return watchedVariants.reduce((sum: number, v: { quantity: number }) => sum + (v.quantity || 0), 0);
  }, [watchedVariants]);

  // 1. Real-time Quantity Sync
  useEffect(() => {
    if (hasExpiry) {
      form.setValue('quantity', totalBatchQuantity, { shouldDirty: true });
    } else if (hasVariants) {
      form.setValue('quantity', totalVariantQuantity, { shouldDirty: true });
    }
  }, [hasExpiry, hasVariants, totalBatchQuantity, totalVariantQuantity, form]);

  // Next batch number generator helper
  const nextBatchNumber = useMemo(() => {
    const all = isNew ? localBatches : allBatches.filter(b => b.productId === (existingProduct?.id ?? ''));
    const year = new Date().getFullYear();
    const n = all.length + 1;
    return `B-${year}-${String(n).padStart(3, '0')}`;
  }, [localBatches, allBatches, existingProduct, isNew]);

  // Map barcodes for duplicates validation
  const barcodeLookup = useMemo(() => {
    const map = new Map<string, typeof items[number]>();
    for (const item of items) {
      if (item.barcode) {
        map.set(item.barcode, item);
      }
    }
    return map;
  }, [items]);

  // Warnings validation — only depends on the specific watched fields, not all of watchedValues
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (sellingRateWatch > 0 && purchaseRateWatch > 0 && sellingRateWatch < purchaseRateWatch) {
      w.push('Selling rate is below purchase rate — you will sell at a loss.');
    }
    if (minimumStockWatch > quantityWatch && quantityWatch > 0) {
      w.push('Minimum stock alert is higher than current stock — this product will immediately appear as low stock.');
    }
    if (hasExpiry && localBatches.length === 0 && isNew) {
      w.push('No batches added yet. Add at least one batch to track expiry.');
    }
    const expiredBatches = localBatches.filter(b => getBatchStatus(b.expiryDate) === 'expired');
    if (expiredBatches.length > 0) {
      w.push(`${expiredBatches.length} batch(es) are already expired.`);
    }
    return w;
  }, [sellingRateWatch, purchaseRateWatch, minimumStockWatch, quantityWatch, hasExpiry, localBatches, isNew]);

  // 2. Switching Expiry ON/OFF & Mutual Exclusion Toggles
  const handleToggleExpiry = useCallback((checked: boolean) => {
    if (checked) {
      // Mutual exclusion
      form.setValue('hasVariants', false, { shouldValidate: true, shouldDirty: true });
      form.setValue('hasExpiry', true, { shouldValidate: true, shouldDirty: true });

      // Migration: Create Opening Batch if quantity already exists
      const currentQty = form.getValues('quantity') || 0;
      if (currentQty > 0) {
        const purchaseRate = form.getValues('purchaseRate') || 0;
        const supplierIds = form.getValues('supplierIds') || [];
        const newBatch: ProductBatch = {
          id: uuidv4(),
          productId: existingProduct?.id || '',
          batchNumber: nextBatchNumber,
          quantity: currentQty,
          purchaseRate: purchaseRate,
          expiryDate: '',
          supplierId: supplierIds[0] || '',
          manufacturingDate: null,
          expiryMonths: null,
          initialQuantity: currentQty,
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          version: 1,
        };
        setLocalBatches([newBatch]);
      }
    } else {
      // Disabling Expiry Migration Confirmation
      const confirm = window.confirm(
        'Are you sure you want to turn off expiry tracking? This will merge all batch stock into standard stock.'
      );
      if (confirm) {
        form.setValue('hasExpiry', false, { shouldValidate: true, shouldDirty: true });
        // Copy weighted average purchase cost & total quantity to standard stock
        form.setValue('purchaseRate', averagePurchaseRate, { shouldValidate: true, shouldDirty: true });
        form.setValue('quantity', totalBatchQuantity, { shouldValidate: true, shouldDirty: true });
        setLocalBatches([]);
      }
    }
  }, [form, nextBatchNumber, existingProduct, averagePurchaseRate, totalBatchQuantity]);

  const handleToggleVariants = useCallback((checked: boolean) => {
    if (checked) {
      // Mutual exclusion
      form.setValue('hasExpiry', false, { shouldValidate: true, shouldDirty: true });
      form.setValue('hasVariants', true, { shouldValidate: true, shouldDirty: true });
      setLocalBatches([]);
    } else {
      form.setValue('hasVariants', false, { shouldValidate: true, shouldDirty: true });
    }
  }, [form]);

  // Save onSubmit handler
  const onSubmit = (data: ProductFormValues) => {
    try {
      if (data.barcode) {
        const duplicate = barcodeLookup.get(data.barcode);
        if (duplicate && duplicate.id !== existingProduct?.id) {
          form.setError('barcode', {
            message: `Barcode already used by "${duplicate.name}"`,
          });
          return;
        }
      }

      const calculatedStock = data.hasExpiry
        ? localBatches.reduce((total, batch) => total + batch.quantity, 0)
        : data.hasVariants
          ? (data.variants || []).reduce((total, v) => total + v.quantity, 0)
          : data.quantity;

      const productData = {
        ...data,
        quantity: calculatedStock,
        barcode: data.barcode ?? '',
        brand: data.brand ?? '',
        supplierId: data.supplierIds?.[0] ?? '',
        supplierIds: data.supplierIds ?? [],
        notes: data.notes ?? '',
        hasExpiry: data.hasExpiry ?? false,
        hasVariants: data.hasVariants ?? false,
        variants: data.variants ?? [],
        profitPerUnit: data.sellingRate - averagePurchaseRate,
        unit: data.unit as ProductUnit,
        imageBase64: data.imageBase64 ?? '',
      };

      if (isNew) {
        const newId = uuidv4();
        add({
          ...productData,
          id: newId,
        } as any);

        for (const batch of localBatches) {
          addBatch({
            ...batch,
            productId: newId,
          } as any);
        }

        toast.success('Product added successfully');
      } else if (existingProduct) {
        update(existingProduct.id, productData);

        // 3. Proper Synchronization of Saved/Deleted Batches
        const currentSavedBatches = allBatches.filter(b => b.productId === existingProduct.id);
        const localBatchIds = new Set(localBatches.map(b => b.id));

        // Delete removed batches
        for (const saved of currentSavedBatches) {
          if (!localBatchIds.has(saved.id)) {
            removeBatch(saved.id);
          }
        }

        // Add or update current local batches
        for (const batch of localBatches) {
          const exists = currentSavedBatches.some(ab => ab.id === batch.id);
          if (exists) {
            updateBatch(batch.id, batch);
          } else {
            addBatch({
              ...batch,
              productId: existingProduct.id,
            } as any);
          }
        }

        toast.success('Product updated successfully');
      }

      setLocation('/inventory');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save product');
    }
  };

  // Local batch handlers
  const handleAddBatch = useCallback(() => {
    setEditingBatch(null);
    setBatchDialogOpen(true);
  }, []);

  const handleEditBatch = useCallback((batch: ProductBatch) => {
    setEditingBatch(batch);
    setBatchDialogOpen(true);
  }, []);

  const handleDeleteBatch = useCallback((bid: string) => {
    setLocalBatches(prev => prev.filter(b => b.id !== bid));
  }, []);

  const handleSaveBatch = (batchData: BatchFormData) => {
    if (editingBatch) {
      setLocalBatches(prev => prev.map(b => b.id === editingBatch.id ? { ...b, ...batchData } : b));
    } else {
      const newBatch: ProductBatch = {
        ...batchData,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        version: 1,
      };
      setLocalBatches(prev => [...prev, newBatch]);
    }
    setBatchDialogOpen(false);
    setEditingBatch(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {isNew ? 'Add Product' : 'Edit Product'}
        </h1>
        <p className="text-muted-foreground">
          {isNew ? 'Create a new item in your inventory catalog' : 'Modify existing product specifications'}
        </p>
      </div>

      {/* Warning Banners */}
      {warnings.length > 0 && (
        <Alert variant="default" className="border-orange-200 bg-orange-50/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-950 font-medium">
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="md:rounded-2xl md:border md:bg-card md:overflow-hidden md:shadow-sm">
            {/* Identity */}
            <ProductIdentitySection
              form={form}
              isNew={isNew}
              existingCategories={existingCategories}
            />

            <Separator />

            {/* Expiry Tracking */}
            <BatchSection
              form={form}
              isExpiryEnabled={isExpiryEnabled}
              isBatchesEnabled={isBatchesEnabled}
              hasExpiry={hasExpiry}
              onToggleExpiry={handleToggleExpiry}
              localBatches={localBatches}
              onAddBatch={handleAddBatch}
              onEditBatch={handleEditBatch}
              onDeleteBatch={handleDeleteBatch}
            />

            <Separator />

            {/* Variants */}
            <VariantSection
              form={form}
              isVariantsEnabled={isVariantsEnabled}
              hasVariants={hasVariants}
              onToggleVariants={handleToggleVariants}
            />

            <Separator />

            {/* Pricing */}
            <PricingSection
              form={form}
              hasExpiry={hasExpiry}
              averagePurchaseRate={averagePurchaseRate}
            />

            <Separator />

            {/* Stock details */}
            <StockSection
              form={form}
              hasExpiry={hasExpiry}
              hasVariants={hasVariants}
              totalBatchQuantity={totalBatchQuantity}
              totalVariantQuantity={totalVariantQuantity}
            />

            <Separator />

            {/* Suppliers */}
            {!hasExpiry && (
              <>
                <SupplierSection
                  form={form}
                  suppliers={suppliers}
                  onSupplierNew={() => setLocation('/suppliers/new')}
                />
                <Separator />
              </>
            )}

            {/* Notes */}
            <NotesSection form={form} />
          </div>

          {/* Action Bar */}
          <SaveBar onBack={goBack} form={form} />
        </form>
      </Form>

      {/* Batch Dialog */}
      <BatchFormDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        onSave={handleSaveBatch}
        editBatch={editingBatch}
        nextBatchNumber={nextBatchNumber}
        suppliers={suppliers}
        productId={existingProduct?.id || ''}
      />
    </div>
  );
}
