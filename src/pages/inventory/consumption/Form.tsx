import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useFeature } from '@/hooks/useFeature';
import { useSmartBack } from '@/contexts/NavigationContext';
import {
    useInventory,
    useLocations,
    useProductBatches,
    useInventoryLocationStocks,
    useConsumptions,
    useInventoryMovements,
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
import { ArrowLeft, Plus, Trash2, ChevronDown } from 'lucide-react';

interface LineItem {
    productId: string;
    quantity: number;
    batchId?: string;
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

    // Get consumable products at selected location
    const consumableProducts = useMemo(() => {
        return products.filter(p => {
            // Include products where consumable is explicitly true, OR undefined (legacy products before Phase 1)
            // Only exclude if explicitly false
            const isConsumable = p.consumable !== false;
            return isConsumable && p.deletedAt === null;
        });
    }, [products]);

    // Get products available at selected location
    const productsAtLocation = useMemo(() => {
        if (!selectedLocationId) return [];
        return consumableProducts.filter(p => {
            const quantityAtLocation = getLocationStockForProduct(p, selectedLocationId, locationStocks);
            const hasLegacyGlobalStock = p.quantity > 0;
            return quantityAtLocation > 0 || hasLegacyGlobalStock;
        });
    }, [consumableProducts, selectedLocationId, locationStocks]);

    // Get batches for a product
    const getBatchesForProduct = (productId: string): Array<{ id: string; number: string; available: number }> => {
        return batches
            .filter(b => b.productId === productId && b.quantity > 0)
            .map(b => ({
                id: b.id,
                number: b.batchNumber || `Batch ${b.id.slice(0, 8)}`,
                available: b.quantity,
            }))
            .sort((a, b) => {
                // Sort by expiry date (FEFO)
                const aBatch = batches.find(x => x.id === a.id);
                const bBatch = batches.find(x => x.id === b.id);
                if (!aBatch || !bBatch) return 0;
                const aExpiry = aBatch.expiryDate ? new Date(aBatch.expiryDate).getTime() : Infinity;
                const bExpiry = bBatch.expiryDate ? new Date(bBatch.expiryDate).getTime() : Infinity;
                return aExpiry - bExpiry;
            });
    };

    // Get product details
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
                key: Math.random().toString(36),
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

    // Calculate summary
    const summary = useMemo(() => {
        let totalItems = 0;
        let totalCost = 0;

        for (const item of lineItems) {
            if (!item.productId || item.quantity <= 0) continue;
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            totalItems += item.quantity;

            // Find batch for cost calculation
            let unitCost = 0;
            if (item.batchId) {
                const batch = batches.find(b => b.id === item.batchId);
                unitCost = batch?.purchaseRate ?? 0;
            } else {
                // Use first available batch's cost
                const productBatches = batches.filter(b => b.productId === item.productId && b.quantity > 0);
                if (productBatches.length > 0) {
                    unitCost = productBatches[0].purchaseRate;
                }
            }

            totalCost += item.quantity * unitCost;
        }

        return { totalItems, totalCost };
    }, [lineItems, products, batches]);

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
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
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
                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                                {locations.filter(l => l.deletedAt === null).map(location => (
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Items</CardTitle>
                                    <CardDescription>
                                        {productsAtLocation.length} consumable products available at this location
                                    </CardDescription>
                                </div>
                                <Button onClick={addLineItem} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {lineItems.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No items added yet. Click "Add Item" to begin.</p>
                                </div>
                            ) : (
                                lineItems.map((item, idx) => (
                                    <div key={item.key} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                                        <div className="flex items-start justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Item {idx + 1}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLineItem(item.key)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Product Select */}
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">Product</label>
                                                <Select
                                                    value={item.productId}
                                                    onValueChange={productId =>
                                                        updateLineItem(item.key, { productId, batchId: undefined })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select product" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {productsAtLocation.map(product => (
                                                            <SelectItem key={product.id} value={product.id}>
                                                                {product.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Quantity Input */}
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">Quantity</label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.quantity || ''}
                                                    onChange={e =>
                                                        updateLineItem(item.key, {
                                                            quantity: Math.max(0, parseFloat(e.target.value) || 0),
                                                        })
                                                    }
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Batch Select */}
                                            {item.productId && (
                                                <div>
                                                    <label className="text-sm font-medium mb-2 block">Batch (Optional)</label>
                                                    <Select
                                                        value={item.batchId || ''}
                                                        onValueChange={batchId =>
                                                            updateLineItem(item.key, {
                                                                batchId: batchId || undefined,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Auto-select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="">Auto-select (FEFO)</SelectItem>
                                                            {getBatchesForProduct(item.productId).map(batch => (
                                                                <SelectItem key={batch.id} value={batch.id}>
                                                                    {batch.number} ({batch.available} available)
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Cost Preview */}
                                        {item.productId && item.quantity > 0 && (
                                            <div className="bg-primary/10 rounded px-3 py-2 text-sm">
                                                {(() => {
                                                    let unitCost = 0;
                                                    if (item.batchId) {
                                                        const batch = batches.find(b => b.id === item.batchId);
                                                        unitCost = batch?.purchaseRate ?? 0;
                                                    } else {
                                                        const productBatches = batches.filter(
                                                            b => b.productId === item.productId && b.quantity > 0
                                                        );
                                                        if (productBatches.length > 0) {
                                                            unitCost = productBatches[0].purchaseRate;
                                                        }
                                                    }
                                                    const totalCost = item.quantity * unitCost;
                                                    return (
                                                        <div className="flex justify-between items-center">
                                                            <span>Cost: ₹{unitCost.toFixed(2)}/unit</span>
                                                            <span className="font-bold">Subtotal: ₹{totalCost.toFixed(2)}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
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
