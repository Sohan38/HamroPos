import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { useBackModal } from '@/contexts/NavigationContext';
import { useInventory, useProductBatches, useSuppliers, useLocations, useInventoryLocationStocks } from '@/contexts/GlobalProviders';
import { useStorageProvider } from '@/storage/StorageContext';
import { createPurchaseForStockIncrease } from '@/services/purchaseHelpers';
import { rankSearch } from '@/utils/search/rank';
import { cn } from '@/lib/utils';
import { getLocationStockForProduct, getProductLocationStockSummary } from '@/lib/locationStock';
import { Users, X } from 'lucide-react';

interface StockAdjustDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdjust?: (productId: string, newQuantity: number, reason: string) => void;
}

export function StockAdjustDialog({ product, open, onClose, onAdjust }: StockAdjustDialogProps) {
  const { update: updateProduct } = useInventory();
  const { items: allBatches, update: updateBatch } = useProductBatches();
  const { items: suppliers } = useSuppliers();
  const { items: locations } = useLocations();
  const { items: locationStocks, update: updateLocationStock, add: addLocationStock } = useInventoryLocationStocks();

  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedVariantName, setSelectedVariantName] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('loc-default');
  const [filterQuery, setFilterQuery] = useState('');

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Memoize batches to prevent recalculation on every keystroke
  const productBatches = useMemo(() => {
    return product ? allBatches.filter(b => b.productId === product.id) : [];
  }, [product, allBatches]);

  const hasExpiry = !!(product?.hasExpiry && productBatches.length > 0);
  const hasVariants = !!(product?.hasVariants && product?.variants && product.variants.length > 0);
  const isMultiSupplier = !!(!hasExpiry && !hasVariants && product?.supplierIds && product.supplierIds.length >= 2);
  const locationStockSummary = useMemo(
    () => product ? getProductLocationStockSummary(product, locations, locationStocks) : [],
    [product, locations, locationStocks],
  );
  const shouldShowLocationSelector = !hasExpiry && !hasVariants && !isMultiSupplier && locationStockSummary.length > 1;

  const productSuppliers = useMemo(() => {
    if (!product || !product.supplierIds) return [];
    const ids = product.supplierIds;
    return suppliers.filter(s => ids.includes(s.id));
  }, [product, suppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = filterQuery.trim();
    if (!query) return productSuppliers;
    return rankSearch(productSuppliers, query, 10);
  }, [productSuppliers, filterQuery]);

  useBackModal(open, onClose, 'stock-adjust-dialog');

  // Reset selections and focus input when dialog opens

  useEffect(() => {
    if (!open || !product) return;

    setSelectedBatchId(productBatches[0]?.id || '');
    setSelectedVariantName(product.variants?.[0]?.name || '');
    const preferredSupplier = isMultiSupplier ? '' : (product.supplierIds?.[0] || '');
    setSelectedSupplierId(preferredSupplier);
    const preferredLocation = shouldShowLocationSelector
      ? (locationStockSummary[0]?.locationId || product.supplierStocks?.[0]?.locationId || 'loc-default')
      : (product.supplierStocks?.find(ss => ss.supplierId === preferredSupplier)?.locationId || locationStockSummary[0]?.locationId || product.supplierStocks?.[0]?.locationId || 'loc-default');
    setSelectedLocationId(preferredLocation);
    setFilterQuery('');
    setAmount('');
    setReason('');
    setMode('add');

    // Delay focus slightly to ensure modal animation has started
    const timer = setTimeout(() => amountInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, product?.id, shouldShowLocationSelector, locationStockSummary]);

  const getSelectedCurrentQty = (): number => {
    if (!product) return 0;

    if (hasVariants) {
      const variant = product.variants?.find(v => v.name === selectedVariantName);
      return variant ? variant.quantity : 0;
    }
    if (hasExpiry) {
      const batch = productBatches.find(b => b.id === selectedBatchId);
      return batch ? batch.quantity : 0;
    }
    if (isMultiSupplier) {
      const entry = product.supplierStocks?.find(ss => ss.supplierId === selectedSupplierId && (ss.locationId || 'loc-default') === (selectedLocationId || 'loc-default'));
      return entry ? entry.stock : 0;
    }
    if (shouldShowLocationSelector) {
      return getLocationStockForProduct(product, selectedLocationId, locationStocks);
    }
    return product.quantity;
  };

  const currentQty = getSelectedCurrentQty();
  const numericAmount = Number(amount) || 0;

  const computeNew = (): number => {
    if (mode === 'add') return currentQty + numericAmount;
    if (mode === 'remove') return Math.max(0, currentQty - numericAmount);
    return Math.max(0, numericAmount); // set
  };

  const newQty = computeNew();
  const diff = newQty - currentQty;

  // Validation logic
  const isInvalid = !amount || numericAmount < 0 || (mode === 'remove' && numericAmount > currentQty) || (isMultiSupplier && !selectedSupplierId);
  const relevantLocationOptions = useMemo(() => {
    const candidates = locations.length > 0 ? locations : [{ id: 'loc-default', name: 'Main Location' }];
    const mappedIds = new Set(locationStockSummary.map(entry => entry.locationId));

    const filtered = candidates.filter(location => mappedIds.has(location.id));
    if (filtered.length > 0) return filtered;

    return candidates.filter(location =>
      product?.supplierStocks?.some(stock => (stock.locationId || 'loc-default') === location.id)
      || location.id === 'loc-default'
    );
  }, [locations, locationStockSummary, product]);

  const locationOptions = relevantLocationOptions;

  const storage = useStorageProvider();

  if (!product) return null;

  const handleSave = async () => {
    if (isMultiSupplier && !selectedSupplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (isInvalid) {
      if (!amount) toast.error('Enter an amount');
      else if (mode === 'remove' && numericAmount > currentQty) toast.error(`Cannot remove more than current stock (${currentQty})`);
      return;
    }

    const finalReason = reason || `Manual ${mode === 'add' ? 'increase' : mode === 'remove' ? 'decrease' : 'set'}`;

    if (hasVariants) {
      const updatedVariants = product.variants?.map(v =>
        v.name === selectedVariantName ? { ...v, quantity: newQty } : v
      ) || [];
      const newTotalQty = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);

      updateProduct(product.id, {
        variants: updatedVariants,
        quantity: newTotalQty
      });
      if (diff > 0) {
        try {
          await createPurchaseForStockIncrease(storage, {
            productId: product.id,
            quantity: diff,
            purchaseRate: product.purchaseRate || undefined,
            supplierId: product.supplierId || product.supplierIds?.[0] || undefined,
            supplierName: undefined,
            notes: finalReason,
          });
        } catch (err) {
          console.error('Failed to create purchase for variant stock increase', err);
          toast.error('Failed to create purchase for stock increase');
        }
      }
      toast.success(`Updated variant "${selectedVariantName}": ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
    } else if (hasExpiry) {
      updateBatch(selectedBatchId, { quantity: newQty });

      const updatedBatches = productBatches.map(b =>
        b.id === selectedBatchId ? { ...b, quantity: newQty } : b
      );
      const newTotalQty = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);

      updateProduct(product.id, {
        quantity: newTotalQty
      });
      const batch = productBatches.find(b => b.id === selectedBatchId);
      toast.success(`Updated batch "${batch?.batchNumber}": ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
      if (diff > 0) {
        try {
          await createPurchaseForStockIncrease(storage, {
            productId: product.id,
            quantity: diff,
            purchaseRate: batch?.purchaseRate ?? product.purchaseRate ?? undefined,
            supplierId: batch?.supplierId || product.supplierId || product.supplierIds?.[0] || undefined,
            supplierName: undefined,
            notes: finalReason,
            batchId: batch?.id,
            batchNumber: batch?.batchNumber,
            manufacturingDate: batch?.manufacturingDate ?? null,
            expiryMonths: batch?.expiryMonths ?? null,
            expiryDate: batch?.expiryDate ?? null,
          });
        } catch (err) {
          console.error('Failed to create purchase for batch stock increase', err);
          toast.error('Failed to create purchase for stock increase');
        }
      }
    } else if (isMultiSupplier) {
      const currentStocks = product.supplierStocks || [];
      const currentLocation = selectedLocationId || 'loc-default';
      const updatedStocks = product.supplierIds?.map(sid => {
        const existing = currentStocks.find(ss => ss.supplierId === sid && (ss.locationId || 'loc-default') === currentLocation);
        if (existing) {
          return sid === selectedSupplierId ? { ...existing, stock: newQty, locationId: currentLocation } : existing;
        }

        const stockVal = sid === selectedSupplierId ? newQty : 0;
        return {
          supplierId: sid,
          locationId: currentLocation,
          cost: product.purchaseRate || 0,
          stock: stockVal,
          supplierSku: '',
          reorderLevel: undefined
        };
      }) || [];

      const newTotalQty = updatedStocks.reduce((sum, ss) => sum + (ss.stock || 0), 0);

      updateProduct(product.id, {
        supplierStocks: updatedStocks,
        quantity: newTotalQty
      });
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const locationName = locationOptions.find(loc => loc.id === currentLocation)?.name ?? 'Main Location';
      toast.success(`Updated stock for supplier "${supplier?.name}" at ${locationName}: ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
      if (diff > 0) {
        const updatedRecord = updatedStocks.find(ss => ss.supplierId === selectedSupplierId && (ss.locationId || 'loc-default') === currentLocation);
        try {
          await createPurchaseForStockIncrease(storage, {
            productId: product.id,
            quantity: diff,
            purchaseRate: updatedRecord?.cost ?? product.purchaseRate ?? undefined,
            supplierId: selectedSupplierId,
            supplierName: supplier?.name ?? undefined,
            notes: finalReason,
          });
        } catch (err) {
          console.error('Failed to create purchase for supplier stock increase', err);
          toast.error('Failed to create purchase for stock increase');
        }
      }
    } else if (shouldShowLocationSelector) {
      const currentLocationQty = getLocationStockForProduct(product, selectedLocationId, locationStocks);
      const nextLocationQty = Math.max(0, newQty);
      const updatedQuantity = Math.max(0, product.quantity + (nextLocationQty - currentLocationQty));
      const existingLocationStock = locationStocks.find(stock => stock.productId === product.id && stock.locationId === selectedLocationId);

      if (existingLocationStock) {
        await updateLocationStock(existingLocationStock.id, {
          quantity: nextLocationQty,
          lastMovementAt: new Date().toISOString(),
        });
      } else {
        await addLocationStock({
          productId: product.id,
          locationId: selectedLocationId,
          quantity: nextLocationQty,
          lastMovementAt: new Date().toISOString(),
        });
      }

      updateProduct(product.id, { quantity: updatedQuantity });
      const locationName = locationOptions.find(loc => loc.id === selectedLocationId)?.name ?? 'Selected Location';
      toast.success(`Updated stock at ${locationName}: ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
      if (diff > 0) {
        try {
          const supplierId = product.supplierId || product.supplierIds?.[0] || undefined;
          await createPurchaseForStockIncrease(storage, {
            productId: product.id,
            quantity: diff,
            purchaseRate: product.purchaseRate || undefined,
            supplierId,
            supplierName: undefined,
            notes: finalReason,
          });
        } catch (err) {
          console.error('Failed to create purchase for location stock increase', err);
          toast.error('Failed to create purchase for stock increase');
        }
      }
    } else {
      updateProduct(product.id, { quantity: newQty });
      if (onAdjust) {
        onAdjust(product.id, newQty, finalReason);
      } else {
        toast.success(`Updated product stock: ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
      }
      if (diff > 0) {
        try {
          const supplierId = product.supplierId || product.supplierIds?.[0] || undefined;
          await createPurchaseForStockIncrease(storage, {
            productId: product.id,
            quantity: diff,
            purchaseRate: product.purchaseRate || undefined,
            supplierId,
            supplierName: undefined,
            notes: finalReason,
          });
        } catch (err) {
          console.error('Failed to create purchase for stock increase', err);
          toast.error('Failed to create purchase for stock increase');
        }
      }
    }
    onClose();
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    onClose();
  };

  // Helper for quick amount buttons
  const handleQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + val));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-sm min-w-0 overflow-hidden">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          className="min-w-0 w-full"
        >
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-w-0 w-full">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="font-semibold truncate">{product.name}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Current Total: <span className="font-bold text-foreground">{product.quantity}</span> {product.unit}
              </div>
            </div>

            {/* Variant Selector */}
            {hasVariants && (
              <div className="space-y-1">
                <Label>Select Variant</Label>
                <Select value={selectedVariantName} onValueChange={setSelectedVariantName}>
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variants?.map(v => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.name} (Current: {v.quantity} {product.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Batch Selector */}
            {hasExpiry && (
              <div className="space-y-1">
                <Label>Select Batch</Label>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger className="w-full min-w-0 bg-card">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>

                  <SelectContent className="max-w-[95vw]">
                    {productBatches.map(b => (
                      <SelectItem
                        key={b.id}
                        value={b.id}
                        className="max-w-full"
                      >
                        <span className="block max-w-full truncate">
                          {b.batchNumber}
                          {b.expiryDate ? ` (Exp: ${b.expiryDate})` : ''}
                          {` - Current: ${b.quantity} ${product.unit}`}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {shouldShowLocationSelector && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Multi-supplier search & selection list */}
            {isMultiSupplier && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((location: any) => (
                        <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Supplier *</Label>
                {selectedSupplierId ? (
                  (() => {
                    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
                    return (
                      <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-2.5 border-border">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {selectedSupplier?.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{selectedSupplier?.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full hover:bg-destructive/15 hover:text-destructive text-muted-foreground"
                          onClick={() => setSelectedSupplierId('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Search product suppliers..."
                        value={filterQuery}
                        onChange={e => setFilterQuery(e.target.value)}
                        className="h-9 text-sm rounded-xl"
                      />
                      {filterQuery && (
                        <button
                          type="button"
                          onClick={() => setFilterQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto py-1">
                      {filteredSuppliers.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId(s.id);
                            const supplierLocation = product.supplierStocks?.find(ss => ss.supplierId === s.id)?.locationId || 'loc-default';
                            setSelectedLocationId(supplierLocation);
                            setFilterQuery('');
                          }}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-muted/50 border-border text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all select-none"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Display status or locked notice */}
            {isMultiSupplier && !selectedSupplierId ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-200/50 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                <Users className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Please select a supplier from the list above first to view and adjust their specific stock level.</span>
              </div>
            ) : (
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <div className="text-xs text-muted-foreground">Adjusting Current Stock:</div>
                <div className="text-lg font-bold text-primary">
                  {currentQty} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span>
                </div>
              </div>
            )}

            {/* Adjustment inputs (disabled/hidden if supplier not selected for multi-supplier) */}
            {(!isMultiSupplier || selectedSupplierId) && (
              <>
                {/* Mode selector */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'add' ? 'default' : 'outline'}
                    onClick={() => setMode('add')}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'remove' ? 'destructive' : 'outline'}
                    onClick={() => setMode('remove')}
                    className="gap-1"
                  >
                    <Minus className="h-3 w-3" /> Remove
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'set' ? 'secondary' : 'outline'}
                    onClick={() => setMode('set')}
                  >
                    Set To
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>
                    {mode === 'add' ? 'Add Quantity' : mode === 'remove' ? 'Remove Quantity' : 'Set New Quantity'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      ref={amountInputRef}
                      type="number"
                      min="0"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()} // Prevent scroll-wheel from changing numbers
                      className="h-12 text-lg font-bold flex-1"
                      data-testid="input-stock-amount"
                    />
                    <div className="flex gap-1">
                      {[1, 5, 10].map(val => (
                        <Button
                          key={val}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-12 px-3 text-xs"
                          onClick={() => handleQuickAmount(val)}
                        >
                          {mode === 'remove' ? `-${val}` : `+${val}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {amount && (
                  <div className={`flex justify-between items-center rounded-lg p-3 text-sm font-medium
                    ${diff > 0 ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                      diff < 0 ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'}`}>
                    <span>New stock</span>
                    <span className="font-bold text-base">
                      {diff > 0 ? '+' : ''}{diff !== 0 ? diff : ''} → {newQty} {product.unit}
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Damaged goods, Physical count correction..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isInvalid} data-testid="button-save-stock-adjust">
              <Save className="h-4 w-4 mr-2" /> Save Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}