import { useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react'; // if not already imported
import { useWatch, useForm } from 'react-hook-form';
import { useLocation, useParams } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { useInventory, useSuppliers, useProductBatches, usePurchases } from '@/contexts/GlobalProviders';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import { PaymentMethod, ProductUnit, ProductBatch, BatchFormData, PurchasePaymentStatus } from '@/types';
import { toast } from 'sonner';
import { BatchFormDialog, getBatchStatus } from '@/components/BatchFormDialog';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useFeature } from '@/hooks/useFeature';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStorageProvider } from '@/storage/StorageContext';
import { createPurchase } from '@/services/purchaseService';
import { createPurchasesForNewItem } from '@/services/purchaseHelpers';

import { StepFormContainer } from '@/components/ui/StepFormContainer';
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
import { SupplierFormDialog } from '@/components/SupplierFormDialog';
import { generateBatchNumber, generateSupplierInvoiceNumber } from '@/utils/numbering';
import { cn } from '@/lib/utils';

type SupplierPurchaseDraft = {
  invoiceNumber: string;
  purchaseDate: string;
  referenceNumber: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PurchasePaymentStatus;
  paidAmount: string;
  notes: string;
};

export default function InventoryForm() {
  const isBatchesEnabled = useFeature('inventory', 'batches');
  const isExpiryEnabled = useFeature('inventory', 'expiry');
  const isVariantsEnabled = useFeature('inventory', 'variants');
  const goBack = useSmartBack('/inventory');
  const [location, setLocation] = useLocation();
  const { id } = useParams();
  const { items, add, update } = useInventory();
  const { items: suppliers } = useSuppliers();
  const { items: allBatches, add: addBatch, update: updateBatch, hardRemove: removeBatch, refresh: refreshBatches } = useProductBatches();
  const { items: purchases, refresh: refreshPurchases } = usePurchases();
  const storage = useStorageProvider();

  // Extract supplierId from query parameters
  const query = typeof window !== 'undefined' && window.location.search
    ? window.location.search.slice(1)
    : (location.includes('?') ? location.split('?')[1] : '');
  const queryParams = new URLSearchParams(query);
  const supplierIdFromQuery = queryParams.get('supplierId');
  const returnTo = queryParams.get('returnTo');
  const decodedReturnTo = (() => {
    if (!returnTo) return '';
    try {
      return decodeURIComponent(returnTo);
    } catch {
      return returnTo;
    }
  })();

  const isNew = !id || id === 'new';
  const existingProduct = useMemo(
    () => (!isNew ? items.find(i => i.id === id) ?? null : null),
    [items, id, isNew]
  );

  const supplierLookup = useMemo(() => {
    const map = new Map<string, typeof suppliers[number]>();

    for (const supplier of suppliers) {
      map.set(supplier.id, supplier);
    }

    return map;
  }, [suppliers]);

  // Local batch list (saved to store on product save)
  const [localBatches, setLocalBatches] = useState<ProductBatch[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [supplierAutoSelected, setSupplierAutoSelected] = useState(false);
  const [supplierPresetName, setSupplierPresetName] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierPurchaseDrafts, setSupplierPurchaseDrafts] = useState<Record<string, SupplierPurchaseDraft>>({});

  // Local batch handlers
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
      supplierStocks: existingProduct.supplierStocks && existingProduct.supplierStocks.length > 0
        ? existingProduct.supplierStocks
        : (existingProduct.supplierId
          ? [{
            supplierId: existingProduct.supplierId,
            cost: existingProduct.purchaseRate || 0,
            stock: existingProduct.quantity || 0,
            supplierSku: '',
            reorderLevel: existingProduct.minimumStock,
            notes: ''
          }]
          : []
        ),
      hasExpiry: existingProduct.hasExpiry ?? false,
      hasVariants: existingProduct.hasVariants ?? false,
      variants: existingProduct.variants ?? [],
      brand: existingProduct.brand ?? '',
      notes: existingProduct.notes ?? '',
      imageBase64: existingProduct.imageBase64 ?? '',
    } : {
      name: '', barcode: '', category: '', brand: '',
      supplierIds: supplierIdFromQuery ? [supplierIdFromQuery] : [],
      supplierStocks: supplierIdFromQuery ? [{ supplierId: supplierIdFromQuery, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined, notes: '' }] : [],
      unit: 'pcs',
      quantity: 0, minimumStock: 5,
      purchaseRate: 0, sellingRate: 0,
      hasExpiry: false, hasVariants: false,
      variants: [], notes: '', imageBase64: '',
    },
  });

  // Targeted watches — each only re-renders when that specific field changes
  const rawHasExpiry = useWatch({ control: form.control, name: 'hasExpiry' });
  const rawHasVariants = useWatch({ control: form.control, name: 'hasVariants' });
  const watchedVariants = useWatch({ control: form.control, name: 'variants' }) || [];
  const purchaseRateWatch = useWatch({ control: form.control, name: 'purchaseRate' });
  const sellingRateWatch = useWatch({ control: form.control, name: 'sellingRate' });
  const quantityWatch = useWatch({ control: form.control, name: 'quantity' });
  const minimumStockWatch = useWatch({ control: form.control, name: 'minimumStock' });
  const watchedSupplierIds = useWatch({ control: form.control, name: 'supplierIds' }) ?? [];
  const watchedSupplierStocks = useWatch({ control: form.control, name: 'supplierStocks' }) ?? [];

  // Auto-select supplier from query parameter if provided and not already selected
  useEffect(() => {
    if (supplierIdFromQuery && isNew && !supplierAutoSelected) {
      const currentSupplierIds = form.getValues('supplierIds') ?? [];
      if (!currentSupplierIds.includes(supplierIdFromQuery)) {
        const currentStocks = form.getValues('supplierStocks') ?? [];
        const currentPurchaseRate = Number(form.getValues('purchaseRate') ?? 0);
        const newStocks = [
          ...currentStocks,
          {
            supplierId: supplierIdFromQuery,
            cost: currentPurchaseRate > 0 ? currentPurchaseRate : 0,
            stock: 0,
            supplierSku: '',
            reorderLevel: undefined,
            notes: ''
          }
        ];
        form.setValue('supplierIds', [...currentSupplierIds, supplierIdFromQuery], { shouldDirty: true });
        form.setValue('supplierStocks', newStocks, { shouldDirty: true });
        setSupplierAutoSelected(true);
      }
    }
  }, [supplierIdFromQuery, isNew, form, supplierAutoSelected]);

  const hasExpiry = (isExpiryEnabled && isBatchesEnabled) ? (rawHasExpiry ?? false) : false;
  const hasVariants = isVariantsEnabled ? (rawHasVariants ?? false) : false;
  const showPurchaseCreationSection = isNew && Boolean(decodedReturnTo && decodedReturnTo.includes('/purchases'));

  // Multi-supplier mode: 2+ suppliers selected
  const isMultiSupplier = !hasExpiry && !hasVariants && watchedSupplierIds.length >= 2;
  const purchaseSupplierIds = useMemo(() => {
    if (watchedSupplierIds.length > 0) return watchedSupplierIds;
    return supplierIdFromQuery ? [supplierIdFromQuery] : [];
  }, [watchedSupplierIds, supplierIdFromQuery]);

  // Total stock from all supplier entries (memoized)
  const totalSupplierStockQuantity = useMemo(() => {
    if (!isMultiSupplier) return 0;
    return (watchedSupplierStocks as any[]).reduce((sum: number, ss: any) => sum + (Number(ss.stock) || 0), 0);
  }, [isMultiSupplier, watchedSupplierStocks]);

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

  // Generate unique brands list from catalog
  const existingBrands = useMemo(() => {
    const brands = new Set<string>();
    for (const item of items) {
      if (item.brand?.trim()) brands.add(item.brand.trim());
    }
    return Array.from(brands).sort();
  }, [items]);

  const existingProductNameLookup = useMemo(() => {
    const lookup = new Set<string>();
    for (const item of items) {
      if (item.deletedAt) continue;
      const normalizedName = item.name?.trim().toLowerCase();
      if (normalizedName) lookup.add(normalizedName);
    }
    return lookup;
  }, [items]);

  // Compute average purchase cost from batches (expiry mode)
  const averagePurchaseRate = useMemo(() => {
    if (!hasExpiry || localBatches.length === 0) return purchaseRateWatch || 0;
    const totalQty = localBatches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalQty === 0) return 0;
    const totalCost = localBatches.reduce((sum, b) => sum + b.purchaseRate * b.quantity, 0);
    return totalCost / totalQty;
  }, [hasExpiry, localBatches, purchaseRateWatch]);

  // Sync purchaseRate from supplierStocks whenever suppliers change:
  //   - 1 supplier → mirror that supplier's cost into purchaseRate
  //   - 2+ suppliers → write weighted-average cost (by stock qty) into purchaseRate
  //   - 0 suppliers / expiry / variants → leave purchaseRate fully editable
  useEffect(() => {
    if (hasExpiry || hasVariants || watchedSupplierIds.length === 0) return;

    const stocks = watchedSupplierStocks as any[];
    let computed = 0;

    if (watchedSupplierIds.length === 1) {
      computed = Number(stocks[0]?.cost) || 0;
    } else {
      // Multi-supplier: weighted average by per-supplier stock; fall back to simple mean
      const totalStock = stocks.reduce((s: number, ss: any) => s + (Number(ss.stock) || 0), 0);
      if (totalStock > 0) {
        computed = stocks.reduce((s: number, ss: any) => s + (Number(ss.cost) || 0) * (Number(ss.stock) || 0), 0) / totalStock;
      } else {
        const withCost = stocks.filter((ss: any) => Number(ss.cost) > 0);
        if (withCost.length > 0) {
          computed = withCost.reduce((s: number, ss: any) => s + Number(ss.cost), 0) / withCost.length;
        }
      }
    }

    const current = form.getValues('purchaseRate');
    if (Math.abs(computed - current) > 0.001) {
      form.setValue('purchaseRate', computed, { shouldDirty: false });
    }
  }, [watchedSupplierIds, watchedSupplierStocks, hasExpiry, hasVariants, form]);

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
    } else if (isMultiSupplier) {
      form.setValue('quantity', totalSupplierStockQuantity, { shouldDirty: true });
    }
  }, [hasExpiry, hasVariants, isMultiSupplier, totalBatchQuantity, totalVariantQuantity, totalSupplierStockQuantity, form]);

  useEffect(() => {
    if (!showPurchaseCreationSection) return;

    setSupplierPurchaseDrafts(prev => {
      const next = { ...prev };
      const validIds = new Set(purchaseSupplierIds);

      for (const supplierId of Object.keys(next)) {
        if (!validIds.has(supplierId)) delete next[supplierId];
      }

      for (const supplierId of purchaseSupplierIds) {
        const existing = next[supplierId];
        const supplier = supplierLookup.get(supplierId)
        const defaultDate = new Date().toLocaleDateString('en-CA');

        if (!existing || !existing.invoiceNumber?.trim()) {
          next[supplierId] = {
            invoiceNumber: generateSupplierInvoiceNumber(purchases, supplier?.name, defaultDate),
            purchaseDate: existing?.purchaseDate || defaultDate,
            referenceNumber: existing?.referenceNumber ?? '',
            paymentMethod: existing?.paymentMethod ?? 'cash',
            paymentStatus: existing?.paymentStatus ?? 'unpaid',
            paidAmount: existing?.paidAmount ?? '0',
            notes: existing?.notes ?? '',
          };
        }
      }

      return next;
    });
  }, [showPurchaseCreationSection, purchaseSupplierIds, suppliers, purchases]);

  const buildBatchNumberForSupplier = useCallback((supplierId: string | null | undefined, existingBatchList: ProductBatch[] = localBatches) => {
    const supplierName = suppliers.find(candidate => candidate.id === supplierId)?.name ?? '';
    const productName = form.getValues('name') ?? '';
    return generateBatchNumber(existingBatchList, { productName, supplierName, date: new Date() });
  }, [form, localBatches, suppliers]);

  // Next batch number generator helper
  const nextBatchNumber = useMemo(() => {
    const all = isNew ? localBatches : allBatches.filter(b => b.productId === (existingProduct?.id ?? ''));
    const supplierId = watchedSupplierIds[0] ?? purchaseSupplierIds[0] ?? '';
    return buildBatchNumberForSupplier(supplierId, all);
  }, [allBatches, buildBatchNumberForSupplier, existingProduct, isNew, localBatches, purchaseSupplierIds, watchedSupplierIds]);

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

  function updatePurchaseDraft(supplierId: string, field: keyof SupplierPurchaseDraft, value: string) {
    setSupplierPurchaseDrafts(prev => ({
      ...prev,
      [supplierId]: {
        ...(prev[supplierId] ?? {
          invoiceNumber: '',
          purchaseDate: new Date().toLocaleDateString('en-CA'),
          referenceNumber: '',
          paymentMethod: 'cash',
          paymentStatus: 'unpaid',
          paidAmount: '0',
          notes: '',
        }),
        [field]: value,
      },
    }));
  }

  function getValidatedPurchaseDraft(draft: SupplierPurchaseDraft, grandTotal: number) {
    const normalizedPaidAmount = Math.max(0, Number(draft.paidAmount) || 0);
    const normalizedGrandTotal = Math.max(0, grandTotal);

    if (draft.paymentStatus === 'partial') {
      if (normalizedPaidAmount <= 0) {
        throw new Error('Partial payments must be greater than zero.');
      }
      if (normalizedPaidAmount > normalizedGrandTotal) {
        throw new Error('Paid amount cannot exceed the invoice total.');
      }
      if (normalizedPaidAmount === normalizedGrandTotal) {
        return { paymentStatus: 'paid' as PurchasePaymentStatus, paidAmount: normalizedGrandTotal };
      }
      return { paymentStatus: 'partial' as PurchasePaymentStatus, paidAmount: normalizedPaidAmount };
    }

    if (draft.paymentStatus === 'paid') {
      return { paymentStatus: 'paid' as PurchasePaymentStatus, paidAmount: normalizedGrandTotal };
    }

    return { paymentStatus: 'unpaid' as PurchasePaymentStatus, paidAmount: 0 };
  }

  // Save onSubmit handler
  const onSubmit = async (data: ProductFormValues) => {
    try {
      const normalizedName = (data.name ?? '').trim().toLowerCase();
      if (isNew && normalizedName && existingProductNameLookup.has(normalizedName)) {
        form.setError('name', {
          type: 'duplicateName',
          message: `A product named "${data.name}" already exists.`,
        });
        return;
      }

      if (data.barcode) {
        const duplicate = barcodeLookup.get(data.barcode);
        if (duplicate && duplicate.id !== existingProduct?.id) {
          form.setError('barcode', {
            message: `Barcode already used by "${duplicate.name}"`,
          });
          return;
        }
      }

      let resolvedSupplierIds = data.supplierIds ?? [];
      // If expiry/batches mode and no explicit suppliers selected, infer suppliers from local batches
      if (hasExpiry && resolvedSupplierIds.length === 0 && localBatches.length > 0) {
        resolvedSupplierIds = Array.from(new Set(localBatches.map(b => b.supplierId).filter(Boolean)));
      }
      const resolvedSupplierStocks = data.supplierStocks ?? [];
      const isMultiSup = !data.hasExpiry && !data.hasVariants && resolvedSupplierIds.length >= 2;

      const calculatedStock = data.hasExpiry
        ? localBatches.reduce((total, batch) => total + batch.quantity, 0)
        : data.hasVariants
          ? (data.variants || []).reduce((total, v) => total + v.quantity, 0)
          : isMultiSup
            ? resolvedSupplierStocks.reduce((sum: number, ss: any) => sum + (Number(ss.stock) || 0), 0)
            : data.quantity;

      // Weighted average purchase rate across supplier stocks (or existing purchaseRate)
      const effectivePurchaseRate = (() => {
        if (isMultiSup && resolvedSupplierStocks.length > 0) {
          const totalStock = resolvedSupplierStocks.reduce((s: number, ss: any) => s + (Number(ss.stock) || 0), 0);
          if (totalStock > 0) {
            const weightedCost = resolvedSupplierStocks.reduce(
              (s: number, ss: any) => s + (Number(ss.cost) || 0) * (Number(ss.stock) || 0),
              0
            );
            return weightedCost / totalStock;
          }
        }
        return averagePurchaseRate;
      })();

      // For single-supplier mode, keep supplierStocks entries but sync stock to match
      // the real product quantity so supplier detail shows accurate data.
      // For multi-supplier mode, use the per-supplier entries as-is (they drive the total).
      const normalizedSupplierStocks = resolvedSupplierStocks.map((ss: any) =>
        isMultiSup
          ? ss
          : { ...ss, stock: calculatedStock, cost: ss.cost || effectivePurchaseRate }
      );

      const productData = {
        ...data,
        quantity: isNew ? 0 : calculatedStock,
        barcode: data.barcode ?? '',
        brand: data.brand ?? '',
        supplierId: resolvedSupplierIds[0] ?? '',
        supplierIds: resolvedSupplierIds,
        supplierStocks: isNew
          ? normalizedSupplierStocks.map((stock: any) => ({ ...stock, stock: 0 }))
          : normalizedSupplierStocks,
        notes: data.notes ?? '',
        hasExpiry: data.hasExpiry ?? false,
        hasVariants: data.hasVariants ?? false,
        variants: data.variants ?? [],
        purchaseRate: (isMultiSup || data.hasExpiry) ? effectivePurchaseRate : data.purchaseRate,
        profitPerUnit: data.sellingRate - effectivePurchaseRate,
        unit: data.unit as ProductUnit,
        imageBase64: data.imageBase64 ?? '',
      };

      const newId = isNew ? uuidv4() : null;
      if (isNew) {
        const createdPurchaseIds: string[] = [];

        await add({
          ...productData,
          id: newId!,
        } as any);

        for (const batch of localBatches) {
          // Persist batch metadata with zero stock for the new product.
          // The incoming purchase will then create the actual stock via purchase apply logic.
          await storage.save('productBatches', {
            ...batch,
            productId: newId,
            quantity: 0,
            initialQuantity: 0,
          } as any);
        }
        // Refresh batches once after saving all
        try { await refreshBatches(); } catch (err) { /* ignore */ }

        try {
          if (newId) {
            const purchaseRequests: Array<any> = [];
            const shouldCreateBatchPurchases = localBatches.length > 0;
            const supplierPurchaseEntries = (resolvedSupplierStocks ?? []).filter((entry: any) => entry?.supplierId && Number(entry.stock) > 0);
            const shouldCreateSupplierPurchases = supplierPurchaseEntries.length > 0;

            if (shouldCreateBatchPurchases) {
              for (const batch of localBatches) {
                const quantity = Number(batch.quantity || 0);
                if (quantity <= 0) continue;

                const supplierId = batch.supplierId || resolvedSupplierIds[0] || productData.supplierId || undefined;
                const supplier = suppliers.find(candidate => candidate.id === supplierId);
                const purchaseRate = Number(batch.purchaseRate ?? productData.purchaseRate ?? 0) || 0;
                const purchaseDate = new Date().toLocaleDateString('en-CA');
                purchaseRequests.push({
                  productId: newId,
                  quantity,
                  purchaseRate,
                  supplierId,
                  supplierName: supplier?.name ?? undefined,
                  invoiceNumber: undefined,
                  date: `${purchaseDate}T${new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                  notes: batch.notes ?? 'Opening stock from product creation',
                  batchId: batch.id,
                  batchNumber: batch.batchNumber,
                  manufacturingDate: batch.manufacturingDate ?? undefined,
                  expiryMonths: batch.expiryMonths ?? undefined,
                  expiryDate: batch.expiryDate ?? undefined,
                });
              }
            } else if (shouldCreateSupplierPurchases) {
              for (const entry of supplierPurchaseEntries) {
                const supplierId = entry?.supplierId;
                const quantity = Number(entry?.stock || 0);
                if (!supplierId || quantity <= 0) continue;

                const supplier = suppliers.find(candidate => candidate.id === supplierId);
                const purchaseDate = new Date().toLocaleDateString('en-CA');
                const purchaseRate = Number(entry?.cost ?? productData.purchaseRate ?? 0) || 0;

                purchaseRequests.push({
                  productId: newId,
                  quantity,
                  purchaseRate,
                  supplierId,
                  supplierName: supplier?.name ?? undefined,
                  invoiceNumber: undefined,
                  date: `${purchaseDate}T${new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                  notes: 'Opening stock from product creation',
                });
              }
            } else {
              const totalQty = Number(calculatedStock || data.quantity || 0) || 0;
              if (totalQty > 0) {
                const fallbackSupplier = resolvedSupplierIds[0] ?? undefined;
                const supplier = suppliers.find(candidate => candidate.id === fallbackSupplier);
                const purchaseDate = new Date().toLocaleDateString('en-CA');
                purchaseRequests.push({
                  productId: newId,
                  quantity: totalQty,
                  purchaseRate: productData.purchaseRate || undefined,
                  supplierId: fallbackSupplier,
                  supplierName: supplier?.name ?? undefined,
                  invoiceNumber: undefined,
                  date: `${purchaseDate}T${new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                  notes: 'Opening stock from product creation',
                });
              }
            }

            const createdPurchases = await createPurchasesForNewItem(storage, purchaseRequests as any);
            for (const createdPurchase of createdPurchases) {
              if (createdPurchase?.id) createdPurchaseIds.push(createdPurchase.id);
            }
          }
        } catch (purchaseError) {
          const rollbackInventory = await storage.get<any>('inventory');
          const rollbackBatches = await storage.get<any>('productBatches');
          const rollbackPurchases = await storage.get<any>('purchases');

          const inventoryWithoutNewProduct = rollbackInventory.filter((record: any) => record.id !== newId);
          const batchesWithoutNewProduct = rollbackBatches.filter((batch: any) => batch.productId !== newId);
          const purchasesWithoutNewOnes = rollbackPurchases.filter((purchase: any) => !createdPurchaseIds.includes(purchase.id));

          await storage.set('inventory', inventoryWithoutNewProduct);
          await storage.set('productBatches', batchesWithoutNewProduct);
          await storage.set('purchases', purchasesWithoutNewOnes);

          console.error('Failed to create purchase for new product:', purchaseError);
          toast.error('Failed to create purchase. Product was not saved.');
          return;
        }

        try {
          // If no purchases were created by supplier/batch logic above, create a fallback purchase
          if (createdPurchaseIds.length === 0) {
            const totalQty = Number(calculatedStock || (data.quantity || 0)) || 0;
            if (totalQty > 0) {
              try {
                const fallbackSupplier = resolvedSupplierIds[0] ?? undefined;
                const createdPurchases = await createPurchasesForNewItem(storage, [{
                  productId: newId!,
                  quantity: totalQty,
                  purchaseRate: productData.purchaseRate || undefined,
                  supplierId: fallbackSupplier,
                  notes: 'Opening stock from product creation',
                }] as any);
                for (const created of createdPurchases) {
                  if (created?.id) createdPurchaseIds.push(created.id);
                }
              } catch (err) {
                console.error('InventoryForm: fallback createPurchase failed', err);
              }
            }
          }

          await refreshPurchases();
          toast.success('Product added successfully');
        } catch (err) {
          console.warn('InventoryForm: refreshPurchases failed', err);
        }
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

      if (isNew && returnTo) {
        const target = new URL(decodeURIComponent(returnTo), window.location.origin);
        target.searchParams.set('productId', newId!);
        setLocation(`${target.pathname}${target.search}`);
      } else {
        setLocation('/inventory');
      }
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

  const [activeStep, setActiveStep] = useState(0);

  const steps = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      content: React.ReactNode;
      fields?: string[];
    }> = [];

    // 1. Product
    result.push({
      id: 'identity',
      label: 'Product',
      content: (
        <ProductIdentitySection
          form={form}
          isNew={isNew}
          existingCategories={existingCategories}
          existingBrands={existingBrands}
          existingNameLookup={existingProductNameLookup}
        />
      ),
      fields: ['name', 'category', 'barcode', 'brand', 'imageBase64'],
    });

    // 2. Inventory (generic — batches + variants together)
    result.push({
      id: 'inventory',
      label: 'Inventory',
      content: (
        <>
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
          <Separator className="my-0" />
          <VariantSection
            form={form}
            isVariantsEnabled={isVariantsEnabled}
            hasVariants={hasVariants}
            onToggleVariants={handleToggleVariants}
          />
        </>
      ),
      fields: ['hasExpiry', 'hasVariants', 'variants'],
    });

    // 3. Suppliers (if not expiry mode)
    if (!hasExpiry) {
      result.push({
        id: 'suppliers',
        label: 'Suppliers',
        content: (
          <SupplierSection
            form={form}
            isNew={isNew}
            suppliers={suppliers}
            existingPurchases={purchases}
            onSupplierNew={(nameValue) => {
              setSupplierPresetName(nameValue ?? '');
              setSupplierDialogOpen(true);
            }}
          />
        ),
        fields: ['supplierIds', 'supplierStocks'],
      });
    }

    // 4. Purchase (conditional)
    if (showPurchaseCreationSection) {
      result.push({
        id: 'purchase',
        label: 'Purchase',
        content: (
          <div className="p-6 md:p-8 bg-muted/20">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold">Purchase capture</h3>
                <p className="text-xs text-muted-foreground">Create one purchase document per supplier for this item.</p>
              </div>
            </div>
            <div className="space-y-4">
              {purchaseSupplierIds.map((supplierId) => {
                const draft = supplierPurchaseDrafts[supplierId];
                const supplier = suppliers.find(c => c.id === supplierId);
                if (!draft) return null;
                return (
                  <Card key={supplierId} className="border-dashed">
                    <CardContent className="p-4 md:p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{supplier?.name ?? 'Supplier'}</p>
                          <p className="text-xs text-muted-foreground">Invoice, payment, and reference details</p>
                        </div>
                        <div className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {draft.paymentStatus}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-1 text-sm font-medium">
                          Supplier invoice #
                          <Input value={draft.invoiceNumber} onChange={e => updatePurchaseDraft(supplierId, 'invoiceNumber', e.target.value)} placeholder="e.g. SUP-2026-001" />
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                          Purchase date
                          <Input type="date" value={draft.purchaseDate} onChange={e => updatePurchaseDraft(supplierId, 'purchaseDate', e.target.value)} />
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                          Reference number
                          <Input value={draft.referenceNumber} onChange={e => updatePurchaseDraft(supplierId, 'referenceNumber', e.target.value)} placeholder="Optional PO or delivery ref" />
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                          Payment method
                          <Select value={draft.paymentMethod} onValueChange={val => updatePurchaseDraft(supplierId, 'paymentMethod', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(['cash', 'qr', 'card', 'bank', 'split'] as PaymentMethod[]).map(m => (
                                <SelectItem className="capitalize" key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                          Payment status
                          <Select value={draft.paymentStatus} onValueChange={val => updatePurchaseDraft(supplierId, 'paymentStatus', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              <SelectItem value="partial">Partially paid</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>
                        {draft.paymentStatus === 'partial' && (
                          <label className="space-y-1 text-sm font-medium">
                            Paid amount
                            <Input type="number" min="0" step="0.01" value={draft.paidAmount} onChange={e => updatePurchaseDraft(supplierId, 'paidAmount', e.target.value)} />
                          </label>
                        )}
                      </div>
                      <label className="space-y-1 text-sm font-medium block">
                        Notes
                        <Textarea value={draft.notes} onChange={e => updatePurchaseDraft(supplierId, 'notes', e.target.value)} placeholder="Delivery notes or payment terms" rows={2} />
                      </label>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ),
        // no fields array – purchase draft isn't part of the schema
      });
    }

    // 5. Pricing & Stock (combined)
    result.push({
      id: 'pricing-stock',
      label: 'Pricing & Stock',
      content: (
        <>
          <PricingSection
            form={form}
            hasExpiry={hasExpiry}
            averagePurchaseRate={averagePurchaseRate}
            hasSupplier={!hasExpiry && watchedSupplierIds.length > 0}
            isMultiSupplier={isMultiSupplier}
          />
          <Separator className="my-0" />
          <StockSection
            form={form}
            isNew={isNew}
            totalBatchQuantity={totalBatchQuantity}
            totalVariantQuantity={totalVariantQuantity}
            isMultiSupplier={isMultiSupplier}
            totalSupplierStockQuantity={totalSupplierStockQuantity}
            hasExpiry={hasExpiry}
            hasVariants={hasVariants}
          />
        </>
      ),
      fields: ['purchaseRate', 'sellingRate', 'quantity', 'minimumStock'],
    });

    // 6. Review & Save (Notes + SaveBar)
    result.push({
      id: 'review',
      label: 'Review & Save',
      content: (
        <div className="p-6 md:p-8 space-y-6">
          <NotesSection form={form} />
          <Separator className="my-0" />
          <div>
            <h3 className="font-semibold mb-2">Review and save product</h3>
            <p className="text-sm text-muted-foreground mb-4">
              All information has been captured. Click the button below to finalise.
            </p>
          </div>
        </div>
      ),
      fields: ['notes'],
    });

    return result;
  }, [
    form, isNew, existingCategories, existingBrands, existingProductNameLookup,
    isExpiryEnabled, isBatchesEnabled, hasExpiry, handleToggleExpiry, localBatches,
    handleAddBatch, handleEditBatch, handleDeleteBatch,
    isVariantsEnabled, hasVariants, handleToggleVariants,
    averagePurchaseRate, watchedSupplierIds, isMultiSupplier,
    totalBatchQuantity, totalVariantQuantity, totalSupplierStockQuantity,
    suppliers, purchases, showPurchaseCreationSection, purchaseSupplierIds,
    supplierPurchaseDrafts, updatePurchaseDraft, goBack
  ]);

  const stepErrors = useMemo(() => {
    const errorFields = Object.keys(form.formState.errors);
    return steps.map(step =>
      step.fields ? step.fields.some(f => errorFields.includes(f)) : false
    );
  }, [steps, form.formState.errors]);

  // after stepErrors definition
  const stepErrorsWithUI = useMemo(() => {
    return stepErrors.map((err, idx) => {
      if (steps[idx]?.id === 'suppliers' && !hasExpiry && watchedSupplierIds.length === 0) {
        return true;
      }
      return err;
    });
  }, [stepErrors, steps, hasExpiry, watchedSupplierIds]);

  const stepsWithReview = useMemo(() => {
    return steps.map((step, idx) => {
      if (step.id !== 'review') return step;

      const anyErrors = stepErrorsWithUI.some(Boolean); // use withUI
      const errorStepIndices = stepErrorsWithUI.reduce<number[]>((acc, err, i) => {
        if (err) acc.push(i);
        return acc;
      }, []);

      return {
        ...step,
        content: (
          <div className="p-6 md:p-8 space-y-6">
            <NotesSection form={form} />
            <Separator className="my-0" />

            {anyErrors ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-destructive">Review incomplete</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Some steps still require attention before you can save this product.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {steps.map((s, i) => {
                    if (!stepErrorsWithUI[i]) return null; // use withUI
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setActiveStep(i)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-muted-foreground/20 bg-card hover:bg-muted/30 transition-colors text-left"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{s.label}</span>
                          <span className="ml-auto text-xs text-destructive underline underline-offset-2">
                            Fix
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-200 bg-green-50/50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-300">Ready to save</h3>
                    <p className="text-sm text-muted-foreground">
                      All steps are complete and valid. Use the button below to finalise.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ),
      };
    });
  }, [steps, stepErrorsWithUI, form, setActiveStep]);

  // Unified bottom navigation
  const totalSteps = steps.length;
  const anyStepHasErrors = stepErrorsWithUI.some(Boolean);

  const footer = activeStep === totalSteps - 1 && !anyStepHasErrors ? (
    // Final step with no errors – show the full SaveBar
    <SaveBar onBack={goBack} form={form} />
  ) : (
    // All other steps, or last step with errors – show only Back + step counter
    <div className={cn(
      'sticky bottom-0 left-0 right-0 z-40 -mx-4 -mb-4 md:-mx-6 md:-mb-6',
      'border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80',
      'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      'shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)]'
    )}>
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
        {/* Back button – on first step calls goBack, otherwise goes to previous step */}
        <Button
          type="button"
          variant="outline"
          onClick={activeStep === 0 ? goBack : () => setActiveStep(prev => prev - 1)}
          className="h-11 rounded-2xl border-border"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>

        {/* Step counter (centered) */}
        <span className="text-sm font-medium text-muted-foreground">
          Step {activeStep + 1} of {totalSteps}
        </span>

        {/* Next button – hidden on last step when errors exist, otherwise normal */}
        {activeStep < totalSteps - 1 ? (
          <Button
            type="button"
            onClick={() => setActiveStep(prev => prev + 1)}
            className="h-11 rounded-2xl font-semibold"
          >
            Next <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <div className="w-10.5" /> // placeholder to keep layout balanced
        )}
      </div>
    </div>
  );


  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {isNew ? 'Add Product' : 'Edit Product'}
        </h1>
        <p className="text-muted-foreground">
          {isNew ? 'Create a new item in your inventory catalog' : 'Modify existing product specifications'}
        </p>
      </div>

      {/* Warning Banners (always visible) */}
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
          <StepFormContainer
            steps={stepsWithReview}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            footer={footer}
            stepErrors={stepErrorsWithUI}
          />
        </form>
      </Form>

      {/* Dialogs – completely unchanged */}
      <BatchFormDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        onSave={handleSaveBatch}
        editBatch={editingBatch}
        isNew={isNew}
        nextBatchNumber={nextBatchNumber}
        suppliers={suppliers}
        productId={existingProduct?.id || ''}
        productName={form.getValues('name') || ''}
        existingBatches={localBatches}
        existingPurchases={purchases}
      />

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={() => { setSupplierDialogOpen(false); setSupplierPresetName(''); }}
        defaultName={supplierPresetName}
        onSuccess={(newSupplierId) => {
          const currentSupplierIds = form.getValues('supplierIds') ?? [];
          if (!currentSupplierIds.includes(newSupplierId)) {
            const currentStocks = form.getValues('supplierStocks') ?? [];
            const newStocks = [
              ...currentStocks,
              { supplierId: newSupplierId, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined, notes: '' }
            ];
            form.setValue('supplierIds', [...currentSupplierIds, newSupplierId], { shouldDirty: true });
            form.setValue('supplierStocks', newStocks, { shouldDirty: true });
          }
          setSupplierDialogOpen(false);
        }}
      />
    </div>
  );
}
