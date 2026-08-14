import { useLocation } from 'wouter';
import { useState, useMemo } from 'react';
import { useLocations, useInventory, useInventoryLocationStocks, useInventoryMovements, useProductBatches, useProductBatchLocations } from '@/contexts/GlobalProviders';
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
    const { items: locationStocks, update: updateLocationStock, add: addLocationStock } = useInventoryLocationStocks();
    const { items: movements, add: addMovement } = useInventoryMovements();
    const { items: batches } = useProductBatches();
    const { items: batchLocations } = useProductBatchLocations();

    // Form state
    const [sourceLocationId, setSourceLocationId] = useState('');
    const [destinationLocationId, setDestinationLocationId] = useState('');
    const [productId, setProductId] = useState('');
    const [batchId, setBatchId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Active locations only
    const activeLocations = useMemo(
        () => locations.filter((loc) => (loc.status ?? 'active') !== 'inactive'),
        [locations],
    );

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

    // Get batches at source location for selected product
    const batchesAtSource = useMemo(() => {
        if (!productId || !sourceLocationId) return [];

        return batches
            .filter((b) => b.productId === productId && b.quantity > 0)
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
    }, [productId, sourceLocationId, batches, batchLocations]);

    // Validation
    const errors = useMemo(() => {
        const errs: string[] = [];

        if (!sourceLocationId) errs.push('Select source location');
        if (!destinationLocationId) errs.push('Select destination location');
        if (sourceLocationId === destinationLocationId) errs.push('Source and destination cannot be the same');
        if (!productId) errs.push('Select product');

        const qty = Number(quantity);
        if (!quantity || qty <= 0) errs.push('Quantity must be greater than 0');
        if (qty > currentStockAtSource) errs.push(`Not enough stock (available: ${currentStockAtSource})`);

        return errs;
    }, [sourceLocationId, destinationLocationId, productId, quantity, currentStockAtSource]);

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

            // 3. Create movement record
            await addMovement({
                productId,
                productName: product.name,
                movementType: 'transfer',
                sourceLocationId,
                destinationLocationId,
                quantity: qty,
                batchId: batchId || null,
                notes: notes || undefined,
                status: 'completed',
            });

            toast.success(`Moved ${qty} × ${product.name} from ${locations.find((l) => l.id === sourceLocationId)?.name} to ${locations.find((l) => l.id === destinationLocationId)?.name}`);

            // Reset form
            setSourceLocationId('');
            setDestinationLocationId('');
            setProductId('');
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
                            <Select value={productId} onValueChange={(val) => { setProductId(val); setBatchId(''); }}>
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

                    {/* Batch selection (if product has batches) */}
                    {productId && batchesAtSource.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="batch">Batch (optional)</Label>
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
                                    (available: {currentStockAtSource})
                                </span>
                            </Label>
                            <Input
                                id="qty"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
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
