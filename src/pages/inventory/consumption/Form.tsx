import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useFeature } from '@/hooks/useFeature';
import { useSmartBack } from '@/contexts/NavigationContext';
import {
    useInventory,
    useLocations,
    useProductBatches,
    useProductBatchLocations,
    useInventoryLocationStocks,
    useConsumptions,
    useInventoryMovements,
    useSuppliers,
} from '@/contexts/GlobalProviders';
import { ConsumptionItemInput, ConsumptionService } from '@/services/consumptionService';
import { getLocationStockForProduct } from '@/lib/locationStock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, MapPin, Package, FileText, IndianRupee, Layers, AlertCircle, Badge } from 'lucide-react';

interface LineItem {
    productId: string;
    quantity: number;
    batchId?: string;
    supplierId?: string;
    key: string; // unique key for form state
}

export function ConsumptionForm() {
    const goBack = useSmartBack('/inventory/consumption');
    const [, setLocation] = useLocation();
    const consumptionEnabled = useFeature('consumption', 'enabled');

    // Storage hooks
    const { items: products, update: updateInventory } = useInventory();
    const { items: locations } = useLocations();
    const { items: batches } = useProductBatches();
    const { items: locationStocks, update: updateInventoryLocationStocks } = useInventoryLocationStocks();
    const { items: consumptions, add: addConsumption } = useConsumptions();
    const { add: addMovement } = useInventoryMovements();
    const { update: updateProductBatches } = useProductBatches();
    const { items: suppliers } = useSuppliers();
    const { items: batchLocations } = useProductBatchLocations();

    // Form state
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [reason, setReason] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Feature check
    if (!consumptionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-6 max-w-md mx-auto text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        Consumption feature is not enabled in your current license configuration.
                    </p>
                </div>
                <Button onClick={() => setLocation('/dashboard')} variant="outline" className="rounded-xl w-full">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // Performance Optimization 1: Memoize consumable products list
    const consumableProducts = useMemo(() => {
        return products.filter(p => p.consumable !== false);
    }, [products]);

    // Performance Optimization 2: Pre-index and memoize available products at the selected location
    const productsAtLocation = useMemo(() => {
        if (!selectedLocationId) return [];

        const productStockMap = new Map<string, number>();

        // Check InventoryLocationStock records first
        for (const stock of locationStocks) {
            if (stock.locationId === selectedLocationId && Number(stock.quantity ?? 0) > 0) {
                const product = consumableProducts.find(p => p.id === stock.productId);
                if (product) {
                    productStockMap.set(product.id, Number(stock.quantity ?? 0));
                }
            }
        }

        // Also check getLocationStockForProduct fallback
        for (const product of consumableProducts) {
            if (!productStockMap.has(product.id)) {
                const stock = getLocationStockForProduct(product, selectedLocationId, locationStocks);
                if (stock > 0) {
                    productStockMap.set(product.id, stock);
                }
            }
        }

        return Array.from(productStockMap.entries())
            .map(([id, stock]) => {
                const product = consumableProducts.find(p => p.id === id);
                return product ? { product, stock } : null;
            })
            .filter((item): item is { product: typeof products[0]; stock: number } => item !== null);
    }, [consumableProducts, selectedLocationId, locationStocks]);

    // Performance Optimization 3: Index suppliers by product ID for quick lookups
    const suppliersByProductMap = useMemo(() => {
        const map = new Map<string, typeof suppliers>();
        for (const p of products) {
            const ids = p.supplierIds?.length ? p.supplierIds : p.supplierId ? [p.supplierId] : [];
            const productSuppliers = suppliers.filter(s => ids.includes(s.id));
            map.set(p.id, productSuppliers);
        }
        return map;
    }, [products, suppliers]);

    const getSuppliersForProduct = (productId: string) => {
        return suppliersByProductMap.get(productId) || [];
    };

    // Performance Optimization 4: Pre-index and memoize batches by product & location (FEFO sorted) to avoid searching everything on render
    const batchesMap = useMemo(() => {
        if (!selectedLocationId) return new Map<string, Array<{ id: string; number: string; available: number; purchaseRate: number }>>();

        const map = new Map<string, Array<{ id: string; number: string; available: number; purchaseRate: number; expiryDate?: string }>>();

        for (const b of batches) {
            if (b.quantity <= 0) continue;

            // Check allocation at this location
            const locationAlloc = batchLocations.find(
                bl => bl.batchId === b.id && bl.locationId === selectedLocationId
            );
            const quantityAtLocation = locationAlloc?.quantity ?? b.quantity;

            if (quantityAtLocation <= 0) continue;

            const list = map.get(b.productId) || [];
            list.push({
                id: b.id,
                number: b.batchNumber || `Batch ${b.id.slice(0, 8)}`,
                available: quantityAtLocation,
                purchaseRate: b.purchaseRate ?? 0,
                expiryDate: b.expiryDate,
            });
            map.set(b.productId, list);
        }

        // Sort each product's batch list by expiry date (FEFO)
        for (const [prodId, list] of map.entries()) {
            list.sort((a, b) => {
                const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                return aExpiry - bExpiry;
            });
        }

        return map;
    }, [batches, batchLocations, selectedLocationId]);

    const getBatchesForProduct = (productId: string, supplierId?: string) => {
        const productBatches = batchesMap.get(productId) || [];
        if (supplierId) {
            // Further filter by supplier if specified
            return productBatches.filter(b => {
                const batchRecord = batches.find(br => br.id === b.id);
                return batchRecord?.supplierId === supplierId;
            });
        }
        return productBatches;
    };

    // Get available stock for a line item (considering batch/supplier selection)
    const getAvailableForItem = (item: LineItem): number => {
        if (!item.productId || !selectedLocationId) return 0;

        if (item.batchId) {
            const batchData = getBatchesForProduct(item.productId, item.supplierId)
                .find(b => b.id === item.batchId);
            return batchData?.available ?? 0;
        }

        const entry = productsAtLocation.find(p => p.product.id === item.productId);
        return entry?.stock ?? 0;
    };

    // Get unit cost for a line item (batch rate or product fallback)
    const getUnitCostForItem = (item: LineItem): number => {
        if (!item.productId) return 0;
        const product = products.find(p => p.id === item.productId);
        if (!product) return 0;

        if (item.batchId) {
            const batch = batches.find(b => b.id === item.batchId);
            return batch?.purchaseRate ?? product.purchaseRate ?? 0;
        }

        const productBatches = getBatchesForProduct(item.productId, item.supplierId);
        if (productBatches.length > 0) {
            return productBatches[0].purchaseRate ?? product.purchaseRate ?? 0;
        }
        return product.purchaseRate ?? 0;
    };

    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.name || 'Unknown';
    };

    // Add new line item
    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                productId: '',
                quantity: 0,
                key: Math.random().toString(36).slice(2, 9),
            },
        ]);
    };

    // Remove line item
    const removeLineItem = (key: string) => {
        setLineItems(lineItems.filter(item => item.key !== key));
    };

    // Update line item
    const updateLineItem = (key: string, updates: Partial<LineItem>) => {
        setLineItems(
            lineItems.map(item =>
                item.key === key ? { ...item, ...updates } : item
            )
        );
    };

    // Performance Optimization 5: Memoize summary calculations
    const summary = useMemo(() => {
        let totalItems = 0;
        let totalCost = 0;

        for (const item of lineItems) {
            if (!item.productId || item.quantity <= 0) continue;
            totalItems += item.quantity;
            totalCost += item.quantity * getUnitCostForItem(item);
        }

        return { totalItems, totalCost };
    }, [lineItems, products, batches, selectedLocationId, batchesMap]);

    // Submit consumption
    const handleSubmit = async () => {
        try {
            if (!selectedLocationId) {
                toast.error('Please select a location');
                return;
            }

            if (lineItems.length === 0) {
                toast.error('Please add at least one item');
                return;
            }

            const validItems = lineItems.filter(
                item => item.productId && item.quantity > 0
            );
            if (validItems.length === 0) {
                toast.error('Please add valid consumption items');
                return;
            }

            // Validate quantities
            for (const item of validItems) {
                const available = getAvailableForItem(item);
                if (item.quantity > available) {
                    const name = getProductName(item.productId);
                    toast.error(`${name}: quantity (${item.quantity}) exceeds available stock (${available})`);
                    return;
                }
            }

            setIsSubmitting(true);

            // Convert to service format
            const consumptionItems: ConsumptionItemInput[] = validItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                batchId: item.batchId,
            }));

            // Prepare consumption
            const result = ConsumptionService.prepareConsumption(
                {
                    locationId: selectedLocationId,
                    items: consumptionItems,
                    reason,
                    notes,
                },
                products,
                batches,
                locationStocks,
                consumptions
            );

            // STEP 1: Persist consumption transaction
            await addConsumption(result.transaction);

            // STEP 2: Persist inventory movements (audit trail)
            for (const movement of result.movements) {
                await addMovement(movement);
            }

            // STEP 3: Apply location stock mutations
            for (const [stockId, stockUpdates] of result.stockUpdates) {
                await updateInventoryLocationStocks(stockId, stockUpdates);
            }

            // STEP 4: Apply batch stock mutations
            for (const [batchId, batchUpdates] of result.batchUpdates) {
                await updateProductBatches(batchId, batchUpdates);
            }

            // STEP 5: Apply product quantity mutations
            for (const [productId, productUpdates] of result.productUpdates) {
                await updateInventory(productId, productUpdates);
            }

            toast.success(
                `Consumption ${result.transaction.referenceNumber} created. ` +
                `Total cost: ₹${result.transaction.totalCost.toFixed(2)}`
            );

            // Navigate to list
            setLocation('/inventory/consumption');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create consumption');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={goBack}
                    className="rounded-full hover:bg-muted shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Consumption</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Record internal consumption of stock items.</p>
                </div>
            </div>

            {/* Location Selection */}
            <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4.5 w-4.5 text-primary" /> Select Origin Location
                    </CardTitle>
                    <CardDescription className="text-xs">Specify the warehouse or retail store location where the stock consumption is taking place.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={selectedLocationId} onValueChange={(v) => {
                        setSelectedLocationId(v);
                        // Reset line items when location changes
                        setLineItems([]);
                    }}>
                        <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                            <SelectValue placeholder="Select origin location" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {locations.filter(l => (l.status ?? 'active') !== 'inactive').map(location => (
                                <SelectItem key={location.id} value={location.id} className="rounded-lg">
                                    {location.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Items Section */}
            {selectedLocationId && (
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 border-b border-muted-foreground/10 bg-muted/20">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                                    <Package className="h-4.5 w-4.5 text-primary" /> Consumable Items List
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {productsAtLocation.length} consumable products currently stocked at this location
                                </CardDescription>
                            </div>
                            <Button onClick={addLineItem} size="sm" className="rounded-xl gap-1.5 shadow-sm shrink-0">
                                <Plus className="h-3.5 w-3.5" /> Add Product Row
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 space-y-4">
                        {lineItems.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-2xl border border-dashed">
                                <p className="text-sm font-medium">No items added to this log yet.</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Click "Add Product Row" above to include stock items.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {lineItems.map((item, idx) => {
                                    const productSuppliers = item.productId ? getSuppliersForProduct(item.productId) : [];
                                    const hasMultipleSuppliers = productSuppliers.length > 1;
                                    const availableBatches = item.productId ? getBatchesForProduct(item.productId, item.supplierId) : [];
                                    const availableStock = getAvailableForItem(item);
                                    const unitCost = getUnitCostForItem(item);

                                    return (
                                        <div key={item.key} className="border border-muted-foreground/10 rounded-2xl p-4 sm:p-5 space-y-4 bg-muted/20 hover:bg-muted/30 transition-colors relative">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-background border-muted-foreground/10">
                                                    Item Row #{idx + 1}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeLineItem(item.key)}
                                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                {/* Product Select */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</Label>
                                                    <Select
                                                        value={item.productId}
                                                        onValueChange={productId =>
                                                            updateLineItem(item.key, { productId, batchId: undefined, supplierId: undefined, quantity: 0 })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 bg-background shadow-sm">
                                                            <SelectValue placeholder="Choose product" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {productsAtLocation.map(({ product, stock }) => (
                                                                <SelectItem key={product.id} value={product.id} className="rounded-lg">
                                                                    {product.name} ({stock} {product.unit || 'units'} available)
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Supplier Select */}
                                                {item.productId && hasMultipleSuppliers && (
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                            Supplier <span className="text-destructive">*</span>
                                                        </Label>
                                                        <Select
                                                            value={item.supplierId || ''}
                                                            onValueChange={supplierId =>
                                                                updateLineItem(item.key, { supplierId: supplierId || undefined, batchId: undefined })
                                                            }
                                                        >
                                                            <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 bg-background shadow-sm">
                                                                <SelectValue placeholder="Choose supplier" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {productSuppliers.map(supplier => (
                                                                    <SelectItem key={supplier.id} value={supplier.id} className="rounded-lg">
                                                                        {supplier.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>

                                            {item.productId && (
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    {/* Batch Select */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                            <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Batch tracking
                                                        </Label>
                                                        <Select
                                                            value={item.batchId || '_auto'}
                                                            onValueChange={batchId =>
                                                                updateLineItem(item.key, {
                                                                    batchId: batchId === '_auto' ? undefined : batchId,
                                                                })
                                                            }
                                                        >
                                                            <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 bg-background shadow-sm">
                                                                <SelectValue placeholder="Auto-select (FEFO)" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="_auto" className="rounded-lg">Auto-select (FEFO)</SelectItem>
                                                                {availableBatches.map(batch => (
                                                                    <SelectItem key={batch.id} value={batch.id} className="rounded-lg">
                                                                        Batch: {batch.number} ({batch.available} available)
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Quantity Input */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                                                            <span>Quantity</span>
                                                            <span className="text-[11px] text-primary font-bold lowercase normal-case bg-primary/10 px-2 py-0.5 rounded-full">
                                                                Max: {availableStock}
                                                            </span>
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={availableStock}
                                                            step="1"
                                                            value={item.quantity || ''}
                                                            onChange={e => {
                                                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                                                const clamped = Math.min(val, availableStock);
                                                                updateLineItem(item.key, { quantity: clamped });
                                                            }}
                                                            placeholder="0"
                                                            className="h-11 rounded-xl border-muted-foreground/20 bg-background shadow-sm"
                                                        />
                                                        {item.quantity > 0 && item.quantity > availableStock && (
                                                            <p className="text-xs text-destructive font-medium mt-1">
                                                                Exceeds available stock level ({availableStock})
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Cost Subtotal Preview */}
                                            {item.productId && item.quantity > 0 && (
                                                <div className="bg-primary/5 rounded-xl border border-primary/10 p-3 text-xs flex justify-between items-center text-foreground/90 font-medium">
                                                    <span className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5 text-muted-foreground" /> Unit cost: ₹{unitCost.toFixed(2)}</span>
                                                    <span className="font-bold text-primary">Subtotal: ₹{(item.quantity * unitCost).toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Additional Information */}
            <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-primary" /> Additional Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="reason" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason for Consumption</Label>
                        <Input
                            id="reason"
                            placeholder="e.g. Staff meal, quality testing, waste disposal, etc."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Notes / Remarks</Label>
                        <Textarea
                            id="notes"
                            placeholder="Provide any additional comments or audit details here..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="rounded-xl border-muted-foreground/20 shadow-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Summary and Actions */}
            <Card className="border border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-foreground">Log Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Items</span>
                            <span className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5 block">{summary.totalItems}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Estimated Cost</span>
                            <span className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5 block">₹{summary.totalCost.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-primary/10">
                        <Button
                            variant="outline"
                            onClick={goBack}
                            disabled={isSubmitting}
                            className="rounded-xl px-5 h-11 border-muted-foreground/20 text-muted-foreground hover:bg-muted/80 bg-background"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || lineItems.length === 0 || !selectedLocationId}
                            className="flex-1 rounded-xl h-11 font-semibold shadow-sm"
                        >
                            {isSubmitting ? 'Logging Consumption...' : 'Confirm & Log Consumption'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
