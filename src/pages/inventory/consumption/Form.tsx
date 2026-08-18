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
import {
    getLocationStockForProduct,
    getProductBatchesAtLocation,
    getSuppliersForProductAtLocation,
    getAvailableStockForSelector,
} from '@/lib/locationStock';
import { InventoryLedgerService } from '@/services/inventoryLedgerService';
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
import { ArrowLeft, Plus, Trash2, ChevronDown } from 'lucide-react';
import { ProductSearchPicker } from '@/components/ProductSearchPicker';
import { SupplierSearchPicker } from '@/components/SupplierSearchPicker';
import { isProductConsumable } from '@/lib/productCapabilities';

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
    const { items: locationStocks, update: updateInventoryLocationStocks, add: addLocationStock } = useInventoryLocationStocks();
    const { items: consumptions, add: addConsumption } = useConsumptions();
    const { add: addMovement } = useInventoryMovements();
    const { update: updateProductBatches } = useProductBatches();
    const { items: suppliers } = useSuppliers();
    const { items: batchLocations, update: updateBatchLocation, add: addBatchLocation } = useProductBatchLocations();

    // Form state
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [reason, setReason] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Feature check
    if (!consumptionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Access Denied</h2>
                    <p className="text-muted-foreground mt-2">
                        Consumption feature is not enabled in your license.
                    </p>
                </div>
                <Button onClick={() => setLocation('/dashboard')} variant="outline">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // Get consumable products
    const consumableProducts = useMemo(() => {
        return products.filter(isProductConsumable);
    }, [products]);

    // Get products available at selected location (with stock amounts)
    // Follows the same pattern as MoveStock's productsAtSource
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

        // Also check getLocationStockForProduct fallback (supplierStocks legacy)
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



    // Get batches for a product at the selected location, FEFO sorted
    const getBatchesForProduct = (productId: string, supplierId?: string): Array<{ id: string; number: string; available: number; purchaseRate: number }> => {
        const results = getProductBatchesAtLocation(productId, selectedLocationId, batches, batchLocations, supplierId);
        return results.map(({ batch, available }) => ({
            id: batch.id,
            number: batch.batchNumber || `Batch ${batch.id.slice(0, 8)}`,
            available,
            purchaseRate: batch.purchaseRate ?? 0,
        }));
    };

    // Get suppliers for a specific product (filtered by those with stock at selected location)
    const getSuppliersForProduct = (productId: string) => {
        const product = products.find(p => p.id === productId);
        return getSuppliersForProductAtLocation(productId, selectedLocationId, product, suppliers, batches, batchLocations);
    };

    // Get available stock for a line item (considering batch/supplier selection)
    const getAvailableForItem = (item: LineItem): number => {
        const product = products.find(p => p.id === item.productId);
        return getAvailableStockForSelector(item.productId || '', selectedLocationId, item.supplierId, item.batchId, product, locationStocks, batches, batchLocations);
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
            return productBatches[0].purchaseRate ?? 0;
        }
        return product.purchaseRate ?? 0;
    };

    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.name || 'Unknown';
    };

    // Add new line item by ID (from ProductSearchPicker selection)
    const addItemById = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // Auto-select supplier if there is only 1 supplier
        const productSuppliers = getSuppliersForProduct(productId);
        const supplierId = productSuppliers.length === 1 ? productSuppliers[0].id : undefined;

        setLineItems(current => [
            ...current,
            {
                productId,
                quantity: 1,
                supplierId,
                key: Math.random().toString(36),
            }
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

    // Calculate summary
    const summary = useMemo(() => {
        let totalItems = 0;
        let totalCost = 0;

        for (const item of lineItems) {
            if (!item.productId || item.quantity <= 0) continue;
            totalItems += item.quantity;
            totalCost += item.quantity * getUnitCostForItem(item);
        }

        return { totalItems, totalCost };
    }, [lineItems, products, batches, selectedLocationId, batchLocations]);

    // Product search list items mapping for ProductSearchPicker
    const productPickerItems = useMemo(() => {
        return productsAtLocation.map(({ product, stock }) => ({
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            category: product.category,
            sublabel: `Available: ${stock} ${product.unit || 'units'}`.trim(),
        }));
    }, [productsAtLocation]);

    // Added product IDs to filter out from ProductSearchPicker list
    const addedProductIds = useMemo(() => new Set(lineItems.map(i => i.productId)), [lineItems]);
    const availableProductItems = useMemo(() => {
        return productPickerItems.filter(p => !addedProductIds.has(p.id));
    }, [productPickerItems, addedProductIds]);

    // Submit consumption
    const handleSubmit = async () => {
        try {
            // Validation
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

            // STEP 3: Apply stock mutations using central Ledger Service
            const mutations = {
                inventory: { items: products, update: updateInventory },
                locationStocks: { items: locationStocks, update: updateInventoryLocationStocks, add: addLocationStock },
                batches: { items: batches, update: updateProductBatches },
                batchLocations: { items: batchLocations, update: updateBatchLocation, add: addBatchLocation },
            };

            for (const item of validItems) {
                await InventoryLedgerService.adjustStock(
                    item.productId,
                    selectedLocationId,
                    -item.quantity,
                    mutations,
                    { batchId: item.batchId }
                );
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
        <div className="min-h-screen bg-linear-to-br from-primary/5 to-secondary/5 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Create Consumption</h1>
                        <p className="text-muted-foreground">
                            Record internal consumption of stock
                        </p>
                    </div>
                </div>

                {/* Location Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle>Location</CardTitle>
                        <CardDescription>Where is the consumption occurring?</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedLocationId} onValueChange={(v) => {
                            setSelectedLocationId(v);
                            // Reset line items when location changes
                            setLineItems([]);
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                                {locations.filter(l => (l.status ?? 'active') !== 'inactive').map(location => (
                                    <SelectItem key={location.id} value={location.id}>
                                        {location.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Items Section */}
                {selectedLocationId && (
                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Items</CardTitle>
                                <CardDescription>
                                    Search and select products to add.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Product search picker */}
                            <ProductSearchPicker
                                label="Select Product"
                                items={availableProductItems}
                                onSelect={addItemById}
                                placeholder="Search by product name or barcode..."
                                emptyMessage="No consumable products available at this location."
                                defaultLimit={8}
                            />

                            <div className="space-y-4 border-t pt-6">
                                <h3 className="text-sm font-semibold">Added items ({lineItems.length})</h3>

                                {lineItems.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <p>No items added yet. Search for products above to begin.</p>
                                    </div>
                                ) : (
                                    lineItems.map((item, idx) => {
                                        const productSuppliers = item.productId ? getSuppliersForProduct(item.productId) : [];
                                        const hasMultipleSuppliers = productSuppliers.length > 1;
                                        const availableBatches = item.productId
                                            ? (hasMultipleSuppliers && !item.supplierId ? [] : getBatchesForProduct(item.productId, item.supplierId))
                                            : [];
                                        const availableStock = getAvailableForItem(item);
                                        const unitCost = getUnitCostForItem(item);
                                        const prodRecord = products.find(p => p.id === item.productId);

                                        return (
                                            <div key={item.key} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-sm">{prodRecord?.name || 'Unknown Product'}</h4>
                                                        <span className="text-xs text-muted-foreground">
                                                            Item {idx + 1}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeLineItem(item.key)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>

                                                {/* Supplier Select (only if product has multiple suppliers) */}
                                                {item.productId && hasMultipleSuppliers && (
                                                    <div>
                                                        <label className="text-sm font-medium mb-2 block">
                                                            Supplier <span className="text-destructive">*</span>
                                                        </label>
                                                        <SupplierSearchPicker
                                                            suppliers={productSuppliers}
                                                            selectedSupplierId={item.supplierId}
                                                            onSelect={supplierId =>
                                                                updateLineItem(item.key, { supplierId, batchId: undefined, quantity: 0 })
                                                            }
                                                            onRemove={() =>
                                                                updateLineItem(item.key, { supplierId: undefined, batchId: undefined, quantity: 0 })
                                                            }
                                                            placeholder="Search supplier..."
                                                        />
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Batch Select */}
                                                    {item.productId && (
                                                        <div>
                                                            <label className="text-sm font-medium mb-2 block">Batch</label>
                                                            <Select
                                                                value={item.batchId || '_auto'}
                                                                onValueChange={batchId =>
                                                                    updateLineItem(item.key, {
                                                                        batchId: batchId === '_auto' ? undefined : batchId,
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Auto-select (FEFO)" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="_auto">Auto-select (FEFO)</SelectItem>
                                                                    {availableBatches.map(batch => (
                                                                        <SelectItem key={batch.id} value={batch.id}>
                                                                            {batch.number} — {batch.available} available
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* Quantity Input */}
                                                    <div>
                                                        <label className="text-sm font-medium mb-2 block">
                                                            Quantity
                                                            {item.productId && (
                                                                <span className="text-muted-foreground font-normal ml-1">
                                                                    (max: {availableStock})
                                                                </span>
                                                            )}
                                                        </label>
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
                                                        />
                                                        {item.quantity > 0 && item.quantity > availableStock && (
                                                            <p className="text-xs text-destructive mt-1">
                                                                Exceeds available stock ({availableStock})
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cost Preview */}
                                                {item.productId && item.quantity > 0 && (
                                                    <div className="bg-primary/10 rounded px-3 py-2 text-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span>Cost: ₹{unitCost.toFixed(2)}/unit</span>
                                                            <span className="font-bold">Subtotal: ₹{(item.quantity * unitCost).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Additional Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Reason (Optional)</label>
                            <Input
                                placeholder="e.g., Staff meal, Testing, Waste disposal"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                            <Textarea
                                placeholder="Additional notes about this consumption..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Summary and Actions */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Items</p>
                                <p className="text-2xl font-bold">{summary.totalItems}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Cost</p>
                                <p className="text-2xl font-bold">₹{summary.totalCost.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                variant="outline"
                                onClick={goBack}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || lineItems.length === 0 || !selectedLocationId}
                            >
                                {isSubmitting ? 'Creating...' : 'Create Consumption'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
