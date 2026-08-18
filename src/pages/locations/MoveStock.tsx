import { useLocation } from 'wouter';
import { useState, useMemo, useEffect } from 'react';
import { useLocations, useInventory, useInventoryLocationStocks, useInventoryMovements, useProductBatches, useProductBatchLocations, useSuppliers } from '@/contexts/GlobalProviders';
import {
    getLocationStockForProduct,
    getProductBatchesAtLocation,
    getSuppliersForProductAtLocation,
    getAvailableStockForSelector,
} from '@/lib/locationStock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, MapPin, Package, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { ProductSearchPicker } from '@/components/ProductSearchPicker';
import { SupplierSearchPicker } from '@/components/SupplierSearchPicker';

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
        const product = inventory.find((p) => p.id === productId);
        return getSuppliersForProductAtLocation(productId, sourceLocationId, product, suppliers, batches, batchLocations);
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

    // Product search list items mapping for ProductSearchPicker
    const availableProductItems = useMemo(() => {
        return productsAtSource.map(({ product, stock }) => ({
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            category: product.category,
            sublabel: `Stock: ${stock} ${product.unit || 'units'}`.trim(),
        }));
    }, [productsAtSource]);

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
        const product = inventory.find((p) => p.id === productId);
        return getAvailableStockForSelector(productId, sourceLocationId, supplierId || undefined, batchId || undefined, product, locationStocks, batches, batchLocations);
    }, [batchId, supplierId, productId, sourceLocationId, inventory, locationStocks, batches, batchLocations]);

    // Auto-clamp quantity when available changes
    useEffect(() => {
        const currentQty = Number(quantity || 0);
        if (currentQty > quantityAvailable) {
            setQuantity(quantityAvailable > 0 ? String(quantityAvailable) : '');
        }
    }, [quantityAvailable, quantity]);

    // Get batches at source location for selected product (filtered by supplier if selected)
    const batchesAtSource = useMemo(() => {
        const results = getProductBatchesAtLocation(productId, sourceLocationId, batches, batchLocations, supplierId || undefined);
        return results.map(({ batch, available }) => ({
            batch,
            quantityAtLocation: available,
        }));
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
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/locations')}
                    className="rounded-full hover:bg-muted shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Move Stock</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Transfer inventory items securely between active locations.</p>
                </div>
            </div>

            {/* Form */}
            <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                <CardHeader className="pb-4 border-b border-muted-foreground/10 bg-muted/20">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        <ArrowLeft className="h-4.5 w-4.5 text-primary rotate-180" /> Stock Transfer Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 space-y-6">
                    {/* Source and Destination Connection Visual Layout */}
                    <div className="grid gap-4 sm:grid-cols-2 relative">
                        {/* Source Location */}
                        <div className="space-y-2">
                            <Label htmlFor="source" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-rose-500" /> Source Location
                            </Label>
                            <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
                                <SelectTrigger id="source" className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm">
                                    <SelectValue placeholder="Select origin location" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {activeLocations.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id} className="rounded-lg">
                                            {loc.name} {loc.isDefault ? '(Default)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Destination Location */}
                        <div className="space-y-2">
                            <Label htmlFor="dest" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-emerald-500" /> Destination Location
                            </Label>
                            <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                                <SelectTrigger id="dest" className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm">
                                    <SelectValue placeholder="Select target location" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {activeLocations.filter((loc) => loc.id !== sourceLocationId).map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id} className="rounded-lg">
                                            {loc.name} {loc.isDefault ? '(Default)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Product Selector */}
                    {sourceLocationId && (
                        <div className="space-y-2 border-t border-muted-foreground/10 pt-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-primary" /> Product to Move
                            </Label>
                            {productId ? (
                                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-muted-foreground/10">
                                    <div>
                                        <p className="font-semibold text-sm">{inventory.find(p => p.id === productId)?.name}</p>
                                        <p className="text-xs text-muted-foreground">Stock: {currentStockAtSource} units</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setProductId(''); setSupplierId(''); setBatchId(''); }}
                                        className="h-8 text-xs text-destructive rounded-lg hover:bg-destructive/10"
                                    >
                                        Change Product
                                    </Button>
                                </div>
                            ) : (
                                <ProductSearchPicker
                                    items={availableProductItems}
                                    onSelect={(id) => {
                                        setProductId(id);
                                        setSupplierId('');
                                        setBatchId('');
                                    }}
                                    placeholder="Search product to move..."
                                    emptyMessage="No stock available at this source location."
                                    defaultLimit={8}
                                />
                            )}
                        </div>
                    )}

                    {/* Supplier selection (if multiple suppliers) */}
                    {productId && productSuppliers.length > 1 && (
                        <div className="space-y-2 border-t border-muted-foreground/10 pt-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Supplier Filter
                            </Label>
                            <SupplierSearchPicker
                                suppliers={productSuppliers}
                                selectedSupplierId={supplierId}
                                onSelect={(val) => { setSupplierId(val); setBatchId(''); }}
                                onRemove={() => { setSupplierId(''); setBatchId(''); }}
                                placeholder="Search supplier..."
                            />
                        </div>
                    )}

                    {/* Batch selection (if product has batches) */}
                    {productId && batchesAtSource.length > 0 && (
                        <div className="space-y-2 border-t border-muted-foreground/10 pt-4">
                            <Label htmlFor="batch" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specific Batch (Optional)</Label>
                            {selectedBatch && selectedBatchSupplier && (
                                <div className="p-3 bg-muted/40 rounded-xl border border-muted-foreground/10 text-xs space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Batch Number:</span><span className="font-semibold text-foreground">{selectedBatch.batchNumber}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Batch Supplier:</span><span className="font-semibold text-foreground">{selectedBatchSupplier.name}</span></div>
                                </div>
                            )}
                            <Select value={batchId} onValueChange={setBatchId}>
                                <SelectTrigger id="batch" className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm">
                                    <SelectValue placeholder="Select specific batch (auto-allocates if empty)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="" className="rounded-lg">Any batch</SelectItem>
                                    {batchesAtSource.map(({ batch, quantityAtLocation }) => (
                                        <SelectItem key={batch.id} value={batch.id} className="rounded-lg">
                                            Batch: {batch.batchNumber} ({quantityAtLocation} available)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Quantity */}
                    {productId && (
                        <div className="space-y-2 border-t border-muted-foreground/10 pt-4">
                            <Label htmlFor="qty" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                                <span>Quantity to Transfer</span>
                                <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                                    Available: {quantityAvailable} units
                                </span>
                            </Label>

                            {batchId && selectedBatch && (
                                <div className="p-3 bg-muted/40 rounded-xl border border-muted-foreground/10 text-xs space-y-1 mb-2">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Batch Stock:</span><span className="font-bold text-foreground">{quantityAvailable} units</span></div>
                                </div>
                            )}

                            {supplierId && !batchId && (
                                <div className="p-3 bg-muted/40 rounded-xl border border-muted-foreground/10 text-xs space-y-1 mb-2">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Supplier Stock:</span><span className="font-bold text-foreground">{quantityAvailable} units</span></div>
                                </div>
                            )}

                            <Input
                                id="qty"
                                type="number"
                                min={0}
                                max={quantityAvailable}
                                value={quantity}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (nextValue === '') {
                                        setQuantity('');
                                        return;
                                    }

                                    const raw = Number(nextValue);
                                    if (Number.isNaN(raw) || raw < 0) {
                                        return;
                                    }

                                    const maxAllowed = Number.isFinite(quantityAvailable) ? quantityAvailable : raw;
                                    setQuantity(String(Math.min(raw, maxAllowed)));
                                }}
                                placeholder="Enter transfer quantity"
                                className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2 border-t border-muted-foreground/10 pt-4">
                        <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Transfer Notes / Remarks
                        </Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Restocking, relocation of branch stocks, customer return..."
                            className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
                        />
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5">
                            <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
                            <AlertDescription>
                                <span className="font-semibold text-sm text-destructive block">Validation Errors:</span>
                                <ul className="list-disc list-inside space-y-1 mt-1 text-xs text-destructive/80 font-medium">
                                    {errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-5 border-t border-muted-foreground/10">
                        <Button
                            variant="outline"
                            onClick={() => setLocation('/locations')}
                            disabled={isLoading}
                            className="rounded-xl px-5 h-11 border-muted-foreground/20 text-muted-foreground hover:bg-muted/80"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isLoading}
                            className="flex-1 rounded-xl h-11 font-semibold shadow-sm"
                        >
                            {isLoading ? 'Processing Transfer...' : 'Confirm & Move Stock'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
