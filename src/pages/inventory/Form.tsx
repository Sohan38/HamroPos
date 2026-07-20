import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { format as fmtDate, parseISO } from 'date-fns';
import { useInventory, useSuppliers, useProductBatches } from '@/contexts/GlobalProviders';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, ImagePlus, Save, Plus, Trash2, FlaskConical,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { ProductUnit, ProductBatch } from '@/types';
import { toast } from 'sonner';
import { BatchFormDialog, ExpiryBadge, getBatchStatus } from '@/components/BatchFormDialog';

// ─── Schema ───────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  barcode: z.string().max(50, 'Barcode too long').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
  brand: z.string().max(50, 'Brand too long').optional(),
  supplierIds: z.array(z.string()).optional(),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').max(999999, 'Too large'),
  minimumStock: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').max(999999, 'Too large'),
  purchaseRate: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative'),
  sellingRate: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0.01, 'Selling rate must be greater than 0'),
  hasExpiry: z.boolean().optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  imageBase64: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const UNITS: ProductUnit[] = ['pcs', 'packet', 'box', 'bottle', 'kg', 'gram', 'litre', 'ml', 'plate', 'cup', 'glass', 'meter', 'roll', 'dozen', 'custom'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function InventoryForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { items, add, update } = useInventory();
  const { items: suppliers } = useSuppliers();
  const { items: allBatches, add: addBatch, update: updateBatch, hardRemove: removeBatch } = useProductBatches();

  const isNew = !id || id === 'new';
  const existingProduct = !isNew ? items.find(i => i.id === id) : null;

  // Local batch list (not yet saved — saved on product save)
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
    defaultValues: existingProduct ? {
      ...existingProduct,
      supplierIds: existingProduct.supplierIds ?? (existingProduct.supplierId ? [existingProduct.supplierId] : []),
      hasExpiry: existingProduct.hasExpiry ?? false,
      brand: existingProduct.brand ?? '',
      notes: existingProduct.notes ?? '',
      imageBase64: existingProduct.imageBase64 ?? '',
    } : {
      name: '', barcode: '', category: '', brand: '',
      supplierIds: [], unit: 'pcs',
      quantity: 0, minimumStock: 5,
      purchaseRate: 0, sellingRate: 0,
      hasExpiry: false, notes: '', imageBase64: '',
    },
  });

  const watchedValues = form.watch();
  const imageBase64 = watchedValues.imageBase64 ?? '';
  const hasExpiry = watchedValues.hasExpiry ?? false;

  const selectedSupplierIds: string[] =
    watchedValues.supplierIds ?? [];

  const averagePurchaseRate = useMemo(() => {
    if (!hasExpiry || localBatches.length === 0) {
      return watchedValues.purchaseRate || 0;
    }

    const totalQty = localBatches.reduce(
      (sum, batch) => sum + batch.quantity,
      0
    );

    if (totalQty === 0) return 0;

    const totalCost = localBatches.reduce(
      (sum, batch) => sum + batch.purchaseRate * batch.quantity,
      0
    );

    return totalCost / totalQty;
  }, [hasExpiry, localBatches, watchedValues.purchaseRate]);

  const profitPerUnit =
    (watchedValues.sellingRate || 0) - averagePurchaseRate;

  const profitMargin =
    watchedValues.sellingRate > 0
      ? Math.round(
        (profitPerUnit / watchedValues.sellingRate) * 100
      )
      : 0;

  // Validation warnings (non-blocking)
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (watchedValues.sellingRate > 0 && watchedValues.purchaseRate > 0 && watchedValues.sellingRate < watchedValues.purchaseRate) {
      w.push('Selling rate is below purchase rate — you will sell at a loss.');
    }
    if (watchedValues.minimumStock > watchedValues.quantity && watchedValues.quantity > 0) {
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
  }, [watchedValues, hasExpiry, localBatches, isNew]);

  // Next batch number generator
  const nextBatchNumber = useMemo(() => {
    const all = isNew ? localBatches : allBatches.filter(b => b.productId === (existingProduct?.id ?? ''));
    const year = new Date().getFullYear();
    const n = all.length + 1;
    return `B-${year}-${String(n).padStart(3, '0')}`;
  }, [localBatches, allBatches, existingProduct, isNew]);

  const barcodeLookup = useMemo(() => {
    const map = new Map<string, typeof items[number]>();

    for (const item of items) {
      if (item.barcode) {
        map.set(item.barcode, item);
      }
    }

    return map;
  }, [items]);

  const sortedBatches = useMemo(() => {
    return [...localBatches].sort(
      (a, b) =>
        (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '')
    );
  }, [localBatches]);

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

        for (const batch of localBatches) {
          const exists = allBatches.some(ab => ab.id === batch.id);

          if (exists) {
            updateBatch(batch.id, batch);
          } else {
            addBatch(batch as any);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be less than 2 MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => form.setValue('imageBase64', reader.result as string);
    reader.readAsDataURL(file);
  };

  // Supplier multi-select toggle
  const toggleSupplier = (sid: string) => {
    const current = form.getValues('supplierIds') ?? [];
    if (current.includes(sid)) {
      form.setValue('supplierIds', current.filter(s => s !== sid));
    } else {
      form.setValue('supplierIds', [...current, sid]);
    }
  };

  // Batch handlers
  const handleSaveBatch = (
    batchData: Omit<ProductBatch, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>
  ) => {
    let updatedBatches: ProductBatch[];

    if (editingBatch) {
      const updated: ProductBatch = {
        ...editingBatch,
        ...batchData,
        updatedAt: new Date().toISOString(),
        version: editingBatch.version + 1,
      };

      updatedBatches = localBatches.map(b =>
        b.id === editingBatch.id ? updated : b
      );

      setLocalBatches(updatedBatches);

      if (!isNew) {
        updateBatch(editingBatch.id, updated);
      }
    } else {
      const now = new Date().toISOString();

      const newBatch: ProductBatch = {
        ...batchData,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      };

      updatedBatches = [...localBatches, newBatch];

      setLocalBatches(updatedBatches);

      if (!isNew && existingProduct) {
        addBatch({
          ...newBatch,
          productId: existingProduct.id,
        } as any);
      }
    }

    if (!isNew && existingProduct && form.getValues('hasExpiry')) {
      const totalStock = updatedBatches.reduce(
        (sum, batch) => sum + batch.quantity,
        0
      );

      update(existingProduct.id, {
        quantity: totalStock,
      });
    }

    setEditingBatch(null);
  };

  const handleDeleteBatch = (batchId: string) => {
    if (!confirm('Remove this batch?')) return;

    const updatedBatches = localBatches.filter(
      batch => batch.id !== batchId
    );

    setLocalBatches(updatedBatches);

    if (!isNew) {
      removeBatch(batchId);

      if (existingProduct && form.getValues('hasExpiry')) {
        const totalStock = updatedBatches.reduce(
          (sum, batch) => sum + batch.quantity,
          0
        );

        update(existingProduct.id, {
          quantity: totalStock,
        });
      }
    }

    toast.success('Batch removed');
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isNew ? 'Add Product' : 'Edit Product'}</h1>
          <p className="text-sm text-muted-foreground">Fill in the details below. Fields marked * are required.</p>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="mb-4 border-orange-300 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700">
            <ul className="list-disc list-inside space-y-0.5 text-sm">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Basic Info ─────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Image */}
                <div className="w-full md:w-32 flex flex-col items-center gap-2">
                  <div
                    className="w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/50 overflow-hidden cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    {imageBase64 ? (
                      <img src={imageBase64} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground text-center px-2">Upload Image</span>
                      </>
                    )}
                    <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </div>
                  {imageBase64 && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive h-auto py-1"
                      onClick={() => form.setValue('imageBase64', '')}>Remove</Button>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl><Input placeholder="e.g. Coca-Cola 500ml" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="barcode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode</FormLabel>
                        <FormControl><Input placeholder="Scan or type barcode" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <FormControl><Input placeholder="e.g. Beverages" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="brand" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl><Input placeholder="e.g. Coca-Cola" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Pricing ────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseRate"
                  render={({ field }) => {
                    const latestBatch = localBatches
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )[0];

                    return (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>

                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            {...field}
                            value={
                              hasExpiry
                                ? averagePurchaseRate.toFixed(2)
                                : field.value
                            }
                            disabled={hasExpiry}
                          />
                        </FormControl>

                        {hasExpiry && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Purchase price is managed from batches.
                          </p>
                        )}

                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField control={form.control} name="sellingRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Rate * (MRP)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min={0.01} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg border ${profitPerUnit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {profitPerUnit >= 0
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className="text-sm font-medium">Profit per unit</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold ${profitPerUnit >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                    {profitPerUnit >= 0 ? '+' : ''}{profitPerUnit.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">({profitMargin}% margin)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Stock ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle>Stock &amp; Inventory</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => {
                    const batchStock = localBatches.reduce(
                      (sum, batch) => sum + batch.quantity,
                      0
                    );

                    return (
                      <FormItem>
                        <FormLabel>Current Stock</FormLabel>

                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            value={hasExpiry ? batchStock : field.value}
                            disabled={hasExpiry}
                          />
                        </FormControl>

                        {hasExpiry && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Stock is automatically calculated from all batches.
                          </p>
                        )}

                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="minimumStock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Alert Threshold</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll see a warning when stock falls at or below this number.
                  </p>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Suppliers ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suppliers added yet. <button type="button" className="text-primary underline" onClick={() => setLocation('/suppliers/new')}>Add a supplier</button></p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suppliers.map(s => {
                    const selected = selectedSupplierIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSupplier(s.id)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                          }`}
                      >
                        {s.name}
                        {selected && <span className="ml-1 opacity-70">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSupplierIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedSupplierIds.length} supplier(s) selected. First selected is used as primary.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Expiry & Batches ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" /> Expiry &amp; Batches
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">This product expires</span>
                  <FormField control={form.control} name="hasExpiry" render={({ field }) => (
                    <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                  )} />
                </div>
              </div>
            </CardHeader>

            {hasExpiry && (
              <CardContent className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-700 text-sm">
                    Each batch can have a different supplier and expiry date. Stock is sold using <strong>FEFO</strong> — earliest expiry first.
                  </AlertDescription>
                </Alert>

                {localBatches.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                    No batches yet. Add your first batch below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedBatches.map(batch => {
                      const supplier = suppliers.find(s => s.id === batch.supplierId);
                      const status = getBatchStatus(batch.expiryDate);
                      return (
                        <div
                          key={batch.id}
                          className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-3 ${status === 'expired' ? 'border-destructive/40 bg-red-50' :
                            status === 'expiring' ? 'border-orange-300/60 bg-orange-50' :
                              'border-border bg-muted/20'
                            }`}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{batch.batchNumber}</span>
                              <ExpiryBadge expiryDate={batch.expiryDate} />
                              {supplier && (
                                <Badge variant="outline" className="text-[10px]">{supplier.name}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                              {batch.manufacturingDate && (
                                <span>Mfg: {fmtDate(parseISO(batch.manufacturingDate), 'dd MMM yyyy')}</span>
                              )}
                              {batch.expiryDate && (
                                <span>Exp: {fmtDate(parseISO(batch.expiryDate), 'dd MMM yyyy')}</span>
                              )}
                              {batch.expiryMonths && (
                                <span>({batch.expiryMonths}m shelf life)</span>
                              )}
                              <span>Qty: {batch.quantity}/{batch.initialQuantity}</span>
                              {batch.purchaseRate > 0 && <span>Rate: {batch.purchaseRate}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => { setEditingBatch(batch); setBatchDialogOpen(true); }}>
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDeleteBatch(batch.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => { setEditingBatch(null); setBatchDialogOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Batch
                </Button>
              </CardContent>
            )}
          </Card>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle>Additional Notes</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Internal notes about this product..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Save Bar ───────────────────────────────────────────── */}
          <div className="sticky bottom-0 md:relative bg-background/80 backdrop-blur-sm p-4 md:p-0 border-t md:border-0 -mx-4 md:mx-0 z-10 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (form.formState.isDirty) {
                  const discard = confirm(
                    'Discard all unsaved changes?'
                  );

                  if (!discard) return;
                }

                setLocation('/inventory');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" className="w-full md:w-auto">
              <Save className="mr-2 h-5 w-5" /> {isNew ? 'Add Product' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Batch Dialog */}
      <BatchFormDialog
        open={batchDialogOpen}
        onClose={() => { setBatchDialogOpen(false); setEditingBatch(null); }}
        onSave={handleSaveBatch}
        suppliers={suppliers}
        productId={existingProduct?.id ?? 'new'}
        editBatch={editingBatch}
        nextBatchNumber={nextBatchNumber}
      />
    </div>
  );
}
