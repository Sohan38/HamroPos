import { useEffect, useMemo, useState, useCallback } from 'react';
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
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { items, add, update } = useInventory();
  const { items: suppliers } = useSuppliers();
  const { items: allBatches, add: addBatch, update: updateBatch, hardRemove: removeBatch } = useProductBatches();
  const { items: purchases, refresh: refreshPurchases } = usePurchases();
  const storage = useStorageProvider();

  // Extract supplierId from query parameters
  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const supplierIdFromQuery = queryParams.get('supplierId');
  const returnTo = queryParams.get('returnTo');

  const isNew = !id || id === 'new';
  const existingProduct = !isNew ? items.find(i => i.id === id) : null;

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
        const newStocks = [
          ...currentStocks,
          { supplierId: supplierIdFromQuery, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined, notes: '' }
        ];
        form.setValue('supplierIds', [...currentSupplierIds, supplierIdFromQuery], { shouldDirty: true });
        form.setValue('supplierStocks', newStocks, { shouldDirty: true });
        setSupplierAutoSelected(true);
      }
    }
  }, [supplierIdFromQuery, isNew, form, supplierAutoSelected]);

  const hasExpiry = (isExpiryEnabled && isBatchesEnabled) ? (rawHasExpiry ?? false) : false;
  const hasVariants = isVariantsEnabled ? (rawHasVariants ?? false) : false;
  const showPurchaseCreationSection = isNew && Boolean(returnTo && returnTo.includes('/purchases'));

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
        const supplier = suppliers.find(candidate => candidate.id === supplierId);
        const defaultDate = new Date().toISOString().slice(0, 10);

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
          purchaseDate: new Date().toISOString().slice(0, 10),
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

      const resolvedSupplierIds = data.supplierIds ?? [];
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
        quantity: showPurchaseCreationSection ? 0 : calculatedStock,
        barcode: data.barcode ?? '',
        brand: data.brand ?? '',
        supplierId: resolvedSupplierIds[0] ?? '',
        supplierIds: resolvedSupplierIds,
        supplierStocks: showPurchaseCreationSection
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
          await addBatch({
            ...batch,
            productId: newId,
          } as any);
        }

        try {
          if (newId && resolvedSupplierIds.length > 0) {
            for (const supplierId of resolvedSupplierIds) {
              const draft = supplierPurchaseDrafts[supplierId];
              const supplierStock = (productData.supplierStocks as any[]).find(record => record.supplierId === supplierId);
              const supplier = suppliers.find(candidate => candidate.id === supplierId);
              const purchaseDate = (draft?.purchaseDate || new Date().toISOString().slice(0, 10)).trim();
              const inferredInvoice = ((draft?.invoiceNumber || supplierStock?.supplierSku || '').trim()) || generateSupplierInvoiceNumber(purchases, supplier?.name, purchaseDate);
              const fallbackPayment = {
                paymentMethod: (draft?.paymentMethod ?? 'cash') as PaymentMethod,
                paymentStatus: (draft?.paymentStatus ?? 'unpaid') as PurchasePaymentStatus,
                paidAmount: (draft?.paidAmount ?? '0') as string,
                referenceNumber: (draft?.referenceNumber ?? '').trim(),
                notes: (draft?.notes ?? '').trim(),
              };

              const supplierBatches = localBatches.filter(batch => batch.supplierId === supplierId);
              const purchaseItems = supplierBatches.length > 0
                ? supplierBatches.map(batch => ({
                  productId: newId,
                  productName: data.name,
                  quantity: Number(batch.quantity) || 0,
                  purchaseRate: Number(batch.purchaseRate) || 0,
                  subtotal: (Number(batch.quantity) || 0) * (Number(batch.purchaseRate) || 0),
                  batchNumber: batch.batchNumber,
                  manufacturingDate: batch.manufacturingDate,
                  expiryMonths: batch.expiryMonths,
                  expiryDate: batch.expiryDate,
                  notes: batch.notes,
                }))
                : (() => {
                  const quantity = Math.max(0, Number(supplierStock?.stock ?? (resolvedSupplierIds.length === 1 ? data.quantity : 0)) || 0);
                  const purchaseRate = Number(supplierStock?.cost ?? productData.purchaseRate) || 0;
                  if (quantity <= 0) return [];
                  return [{
                    productId: newId,
                    productName: data.name,
                    quantity,
                    purchaseRate,
                    subtotal: quantity * purchaseRate,
                    notes: '',
                  }];
                })();

              if (purchaseItems.length === 0) continue;

              const subtotal = purchaseItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
              const validatedPayment = getValidatedPurchaseDraft({
                invoiceNumber: inferredInvoice,
                purchaseDate,
                referenceNumber: fallbackPayment.referenceNumber,
                paymentMethod: fallbackPayment.paymentMethod,
                paymentStatus: fallbackPayment.paymentStatus,
                paidAmount: fallbackPayment.paidAmount,
                notes: fallbackPayment.notes,
              }, subtotal);
              const purchasePayload = {
                invoiceNumber: inferredInvoice,
                supplierId,
                supplierName: supplier?.name ?? null,
                date: new Date(`${purchaseDate}T${new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`).toISOString(),
                items: purchaseItems,
                discount: 0,
                tax: 0,
                grandTotal: subtotal,
                paymentMethod: fallbackPayment.paymentMethod,
                paymentStatus: validatedPayment.paymentStatus,
                paidAmount: validatedPayment.paidAmount,
                referenceNumber: fallbackPayment.referenceNumber,
                notes: fallbackPayment.notes,
                status: 'received' as const,
              };

              const createdPurchase = await createPurchase(storage, purchasePayload as any);
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

        refreshPurchases();
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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
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
              existingBrands={existingBrands}
              existingNameLookup={existingProductNameLookup}
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
              hasSupplier={!hasExpiry && watchedSupplierIds.length > 0}
              isMultiSupplier={isMultiSupplier}
            />

            <Separator />

            {/* Stock details */}
            <StockSection
              form={form}
              hasExpiry={hasExpiry}
              hasVariants={hasVariants}
              totalBatchQuantity={totalBatchQuantity}
              totalVariantQuantity={totalVariantQuantity}
              isMultiSupplier={isMultiSupplier}
              totalSupplierStockQuantity={totalSupplierStockQuantity}
            />

            <Separator />

            {/* Suppliers */}
            {!hasExpiry && (
              <>
                <SupplierSection
                  form={form}
                  suppliers={suppliers}
                  existingPurchases={purchases}
                  onSupplierNew={(nameValue) => {
                    setSupplierPresetName(nameValue ?? '');
                    setSupplierDialogOpen(true);
                  }}
                />
                <Separator />
              </>
            )}

            {showPurchaseCreationSection && (
              <>
                <div className="p-6 md:p-8 bg-muted/20">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold">Purchase capture</h3>
                      <p className="text-xs text-muted-foreground">Create one purchase document per supplier for this item. Batch tracking uses the batch entries below.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {purchaseSupplierIds.map((supplierId) => {
                      const draft = supplierPurchaseDrafts[supplierId];
                      const supplier = suppliers.find(candidate => candidate.id === supplierId);
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
                                <Input value={draft.invoiceNumber} onChange={event => updatePurchaseDraft(supplierId, 'invoiceNumber', event.target.value)} placeholder="e.g. SUP-2026-001" />
                              </label>
                              <label className="space-y-1 text-sm font-medium">
                                Purchase date
                                <Input type="date" value={draft.purchaseDate} onChange={event => updatePurchaseDraft(supplierId, 'purchaseDate', event.target.value)} />
                              </label>
                              <label className="space-y-1 text-sm font-medium">
                                Reference number
                                <Input value={draft.referenceNumber} onChange={event => updatePurchaseDraft(supplierId, 'referenceNumber', event.target.value)} placeholder="Optional PO or delivery ref" />
                              </label>
                              <label className="space-y-1 text-sm font-medium">
                                Payment method
                                <Select value={draft.paymentMethod} onValueChange={value => updatePurchaseDraft(supplierId, 'paymentMethod', value)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {(['cash', 'qr', 'card', 'bank', 'split'] as PaymentMethod[]).map(method => (
                                      <SelectItem className="capitalize" key={method} value={method}>{method}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </label>
                              <label className="space-y-1 text-sm font-medium">
                                Payment status
                                <Select value={draft.paymentStatus} onValueChange={value => updatePurchaseDraft(supplierId, 'paymentStatus', value)}>
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
                                  <Input type="number" min="0" step="0.01" value={draft.paidAmount} onChange={event => updatePurchaseDraft(supplierId, 'paidAmount', event.target.value)} />
                                </label>
                              )}
                            </div>

                            <label className="space-y-1 text-sm font-medium block">
                              Notes
                              <Textarea value={draft.notes} onChange={event => updatePurchaseDraft(supplierId, 'notes', event.target.value)} placeholder="Delivery notes or payment terms" rows={2} />
                            </label>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
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
        productName={form.getValues('name') || ''}
        existingBatches={localBatches}
        existingPurchases={purchases}
      />

      {/* Supplier Dialog */}
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
