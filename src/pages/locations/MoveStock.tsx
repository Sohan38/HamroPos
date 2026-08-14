import { useLocation } from 'wouter';
import { useState, useMemo, useEffect } from 'react';
import { useLocations, useInventory, useInventoryLocationStocks, useInventoryMovements, useProductBatches, useProductBatchLocations, useSuppliers } from '@/contexts/GlobalProviders';
import { getLocationStockForProduct } from '@/lib/locationStock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

export default function MoveStockPage() {
    const [, setLocation] = useLocation();
    const { items: locations } = useLocations();
    const { items: inventory } = useInventory();
    const { items: suppliers } = useSuppliers();
    const { items: locationStocks, update: updateLocationStock, add: addLocationStock } = useInventoryLocationStocks();
    const { items: movements, add: addMovement } = useInventoryMovements();
    const { items: batches } = useProductBatches();
    const { items: batchLocations, update: updateBatchLocation, add: addBatchLocation } = useProductBatchLocations();

    // Form state
    const [sourceLocationId, setSourceLocationId] = useState('');
    const [destinationLocationId, setDestinationLocationId] = useState('');
    const [productId, setProductId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [batchId, setBatchId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Active locations only
    const activeLocations = useMemo(
        () => locations.filter((loc) => (loc.status ?? 'active') !== 'inactive'),
        [locations],
    );

    // Get suppliers for the selected product (filtered by those with stock at source location)
    const productSuppliers = useMemo(() => {
        if (!productId || !sourceLocationId) return [];
        const product = inventory.find((p) => p.id === productId);
        if (!product) return [];

        const ids = product.supplierIds?.length ? product.supplierIds : product.supplierId ? [product.supplierId] : [];
        const allProductSuppliers = suppliers.filter(supplier => ids.includes(supplier.id));

        // Filter to only suppliers that have batches with stock at the source location
        return allProductSuppliers.filter(supplier => {
            const supplierBatches = batches.filter(
                (b) => b.productId === productId && b.supplierId === supplier.id,
            );
            for (const batch of supplierBatches) {
                const batchLocationAlloc = batchLocations.find(
                    (bl) => bl.batchId === batch.id && bl.locationId === sourceLocationId,
                );
                if (batchLocationAlloc && batchLocationAlloc.quantity > 0) {
                    return true;
                }
            }
            return false;
        });
    }, [productId, sourceLocationId, inventory, suppliers, batches, batchLocations]);

    // Get products at source location
    const productsAtSource = useMemo(() => {
        if (!sourceLocationId) return [];

        const productIds = new Set<string>();
        const stockByProduct = new Map<string, number>();

        for (const stock of locationStocks) {
            if (stock.locationId === sourceLocationId) {
                productIds.add(stock.productId);
                stockByProduct.set(stock.productId, Number(stock.quantity ?? 0));
            }
        }

        for (const product of inventory) {
            const stock = getLocationStockForProduct(product, sourceLocationId, locationStocks);
            if (stock > 0) {
                productIds.add(product.id);
                stockByProduct.set(product.id, stock);
            }
        }

        return Array.from(productIds)
            .map((id) => {
                const product = inventory.find((p) => p.id === id);
                return product
                    ? { product, stock: stockByProduct.get(id) ?? 0 }
                    : null;
            })
            .filter((item) => item !== null) as Array<{ product: any; stock: number }>;
    }, [sourceLocationId, inventory, locationStocks]);

    // Get current stock at source
    const currentStockAtSource = useMemo(() => {
        if (!productId || !sourceLocationId) return 0;
        const product = inventory.find((p) => p.id === productId);
        if (!product) return 0;
        return getLocationStockForProduct(product, sourceLocationId, locationStocks);
    }, [productId, sourceLocationId, inventory, locationStocks]);

    // Get selected batch info
    const selectedBatch = useMemo(() => {
        if (!batchId) return null;
        return batches.find((b) => b.id === batchId) ?? null;
    }, [batchId, batches]);

    // Get selected batch supplier name
    const selectedBatchSupplier = useMemo(() => {
        if (!selectedBatch) return null;
        return suppliers.find((s) => s.id === selectedBatch.supplierId) ?? null;
    }, [selectedBatch, suppliers]);

    // Calculate quantity available for the selected batch
    const quantityAvailable = useMemo(() => {
        if (batchId && selectedBatch) {
            // If batch selected, return quantity at that batch's location
            const batchLocationAlloc = batchLocations.find(
                (bl) => bl.batchId === batchId && bl.locationId === sourceLocationId,
            );
            return batchLocationAlloc?.quantity ?? 0;
        }

        if (supplierId && !batchId) {
            // If supplier selected but no batch, calculate supplier's total stock at location
            const supplierBatches = batches.filter(
                (b) => b.productId === productId && b.supplierId === supplierId,
            );
            let supplierStockAtLocation = 0;
            for (const batch of supplierBatches) {
                const batchLocationAlloc = batchLocations.find(
                    (bl) => bl.batchId === batch.id && bl.locationId === sourceLocationId,
                );
                supplierStockAtLocation += batchLocationAlloc?.quantity ?? 0;
            }
            return supplierStockAtLocation > 0 ? supplierStockAtLocation : 0;
        }

        // If no batch or supplier selected, return total stock at location
        return currentStockAtSource;
    }, [batchId, selectedBatch, supplierId, productId, sourceLocationId, currentStockAtSource, batches, batchLocations]);

    // Auto-clamp quantity when available changes
    useEffect(() => {
        const currentQty = Number(quantity || 0);
        if (currentQty > quantityAvailable) {
            setQuantity(quantityAvailable > 0 ? String(quantityAvailable) : '');
        }
    }, [quantityAvailable, quantity]);

    // Get batches at source location for selected product (filtered by supplier if selected)
    const batchesAtSource = useMemo(() => {
        if (!productId || !sourceLocationId) return [];

        return batches
            .filter((b) => {
                if (b.productId !== productId || b.quantity <= 0) return false;
                // If supplier selected, only show batches from that supplier
                if (supplierId && b.supplierId !== supplierId) return false;
                return true;
            })
            .map((batch) => {
                const locationAllocation = batchLocations.find(
                    (bl) => bl.batchId === batch.id && bl.locationId === sourceLocationId,
                );
                return {
                    batch,
                    quantityAtLocation: locationAllocation?.quantity ?? 0,
                };
            })
            .filter((item) => item.quantityAtLocation > 0);
    }, [productId, sourceLocationId, supplierId, batches, batchLocations]);

    // Validation
    const errors = useMemo(() => {
        const errs: string[] = [];

        if (!sourceLocationId) errs.push('Select source location');
        if (!destinationLocationId) errs.push('Select destination location');
        if (sourceLocationId === destinationLocationId) errs.push('Source and destination cannot be the same');
        if (!productId) errs.push('Select product');
        if (productSuppliers.length > 1 && !supplierId) errs.push('Select supplier');

        const qty = Number(quantity);
        if (!quantity || qty <= 0) errs.push('Quantity must be greater than 0');
        if (qty > quantityAvailable) errs.push(`Not enough stock (available: ${quantityAvailable})`);

        return errs;
    }, [sourceLocationId, destinationLocationId, productId, supplierId, quantity, quantityAvailable, productSuppliers.length]);

    const canSubmit = errors.length === 0;

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast.error('Please fix errors above');
            return;
        }

        setIsLoading(true);
        try {
            const product = inventory.find((p) => p.id === productId);
            if (!product) throw new Error('Product not found');

            const qty = Number(quantity);
            const now = new Date().toISOString();

            // Get batch info if moving a specific batch
            let batchSupplierId = null;
            if (batchId && selectedBatch) {
                batchSupplierId = selectedBatch.supplierId;
            }

            // 1. Get or create location stock records for source and destination
            let sourceStock = locationStocks.find(
                (s) => s.productId === productId && s.locationId === sourceLocationId,
            );
            let destStock = locationStocks.find(
                (s) => s.productId === productId && s.locationId === destinationLocationId,
            );

            // 2. Reduce source and increase destination
            if (sourceStock) {
                await updateLocationStock(sourceStock.id, {
                    quantity: Math.max(0, Number(sourceStock.quantity ?? 0) - qty),
                    lastMovementAt: now,
                });
            }

            if (destStock) {
                await updateLocationStock(destStock.id, {
                    quantity: Number(destStock.quantity ?? 0) + qty,
                    lastMovementAt: now,
                });
            } else {
                await addLocationStock({
                    productId,
                    locationId: destinationLocationId,
                    quantity: qty,
                    lastMovementAt: now,
                });
            }

            // 3. Update batch location allocation if a batch was moved
            if (selectedBatch && batchId) {
                const sourceBatchAllocation = batchLocations.find(
                    (bl) => bl.batchId === batchId && bl.locationId === sourceLocationId,
                );
                const destBatchAllocation = batchLocations.find(
                    (bl) => bl.batchId === batchId && bl.locationId === destinationLocationId,
                );

                // Reduce batch quantity at source
                if (sourceBatchAllocation) {
                    await updateBatchLocation(sourceBatchAllocation.id, {
                        quantity: Math.max(0, Number(sourceBatchAllocation.quantity ?? 0) - qty),
                    });
                }

                // Increase batch quantity at destination (or create new allocation)
                if (destBatchAllocation) {
                    await updateBatchLocation(destBatchAllocation.id, {
                        quantity: Number(destBatchAllocation.quantity ?? 0) + qty,
                        dateReceived: destBatchAllocation.dateReceived || now,
                    });
                } else {
                    // Create new batch location allocation for destination
                    await addBatchLocation({
                        batchId: batchId,
                        locationId: destinationLocationId,
                        quantity: qty,
                        dateReceived: now,
                    });
                }
            }

            // 4. Create movement record with batch and supplier info
            await addMovement({
                productId,
                productName: product.name,
                movementType: 'transfer',
                sourceLocationId,
                destinationLocationId,
                quantity: qty,
                batchId: batchId || null,
                supplierId: batchSupplierId || null,
                notes: notes || undefined,
                status: 'completed',
            });

            toast.success(`Moved ${qty} × ${product.name}${selectedBatch ? ` (${selectedBatch.batchNumber})` : ''} from ${locations.find((l) => l.id === sourceLocationId)?.name} to ${locations.find((l) => l.id === destinationLocationId)?.name}`);

            // Reset form
            setSourceLocationId('');
            setDestinationLocationId('');
            setProductId('');
            setSupplierId('');
            setBatchId('');
            setQuantity('');
            setNotes('');

            setLocation('/locations');
        } catch (error) {
            console.error('Move stock failed:', error);
            toast.error('Failed to move stock. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 pb-24 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setLocation('/locations')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Move stock</h1>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Stock transfer between locations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Source Location */}
                    <div className="space-y-2">
                        <Label htmlFor="source">Source location</Label>
                        <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                            <SelectTrigger id="source">
                                <SelectValue placeholder="Select source location" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeLocations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Destination Location */}
                    <div className="space-y-2">
                        <Label htmlFor="dest">Destination location</Label>
                        <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                            <SelectTrigger id="dest">
                                <SelectValue placeholder="Select destination location" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeLocations.filter((loc) => loc.id !== sourceLocationId).map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Product */}
                    {sourceLocationId && (
                        <div className="space-y-2">
                            <Label htmlFor="product">Product</Label>
                            <Select value={productId} onValueChange={(val) => { setProductId(val); setSupplierId(''); setBatchId(''); }}>
                                <SelectTrigger id="product">
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productsAtSource.map(({ product, stock }) => (
                                        <SelectItem key={product.id} value={product.id}>
                                            {product.name} ({stock} available)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {productsAtSource.length === 0 && (
                                <p className="text-xs text-muted-foreground">No products at this location</p>
                            )}
                        </div>
                    )}

                    {/* Supplier selection (if multiple suppliers) */}
                    {productId && productSuppliers.length > 1 && (
                        <div className="space-y-2">
                            <Label htmlFor="supplier">Supplier</Label>
                            <Select value={supplierId} onValueChange={(val) => { setSupplierId(val); setBatchId(''); }}>
                                <SelectTrigger id="supplier">
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All suppliers</SelectItem>
                                    {productSuppliers.map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Batch selection (if product has batches) */}
                    {productId && batchesAtSource.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="batch">Batch (optional)</Label>
                            {selectedBatch && selectedBatchSupplier && (
                                <div className="mb-2 p-2 bg-muted rounded text-sm">
                                    <div>Batch: <span className="font-medium">{selectedBatch.batchNumber}</span></div>
                                    <div>Supplier: <span className="font-medium">{selectedBatchSupplier.name}</span></div>
                                </div>
                            )}
                            <Select value={batchId} onValueChange={setBatchId}>
                                <SelectTrigger id="batch">
                                    <SelectValue placeholder="Select specific batch or leave empty" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Any batch</SelectItem>
                                    {batchesAtSource.map(({ batch, quantityAtLocation }) => (
                                        <SelectItem key={batch.id} value={batch.id}>
                                            {batch.batchNumber} ({quantityAtLocation} available)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Quantity */}
                    {productId && (
                        <div className="space-y-2">
                            <Label htmlFor="qty">
                                Quantity
                                <span className="text-xs text-muted-foreground ml-2">
                                    (available: {quantityAvailable})
                                </span>
                            </Label>
                            {batchId && selectedBatch && (
                                <div className="mb-2 p-2 bg-muted rounded text-sm">
                                    <div>Batch: <span className="font-medium">{selectedBatch.batchNumber}</span></div>
                                    <div>Available: <span className="font-medium">{quantityAvailable}</span></div>
                                </div>
                            )}
                            {supplierId && !batchId && (
                                <div className="mb-2 p-2 bg-muted rounded text-sm">
                                    <div>Supplier: <span className="font-medium">{productSuppliers.find(s => s.id === supplierId)?.name || 'Unknown'}</span></div>
                                    <div>Supplier stock: <span className="font-medium">{quantityAvailable}</span></div>
                                </div>
                            )}
                            <Input
                                id="qty"
                                type="number"
                                min={1}
                                max={quantityAvailable}
                                value={quantity}
                                onChange={(event) => {
                                    const raw = Number(event.target.value);
                                    if (Number.isNaN(raw)) {
                                        setQuantity('');
                                        return;
                                    }
                                    setQuantity(String(Math.max(1, Math.min(raw, quantityAvailable))));
                                }}
                                placeholder="Enter quantity to move"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g., 'Restocking Branch B', 'Customer return', etc."
                        />
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                    {errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => setLocation('/locations')}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isLoading}
                            className="flex-1"
                        >
                            {isLoading ? 'Moving...' : 'Confirm move'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
