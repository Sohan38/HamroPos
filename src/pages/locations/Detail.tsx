import { useParams, useLocation } from 'wouter';
import { useState, useMemo } from 'react';
import { useLocations, useInventory, useInventoryLocationStocks, useProductBatches, useInventoryMovements, useProductBatchLocations } from '@/contexts/GlobalProviders';
import { getLocationStockForProduct } from '@/lib/locationStock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Search, X, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

export default function LocationDetail() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const { items: locations } = useLocations();
    const { items: inventory } = useInventory();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: batches } = useProductBatches();
    const { items: batchLocations } = useProductBatchLocations();
    const { items: movements } = useInventoryMovements();
    const { format } = useCurrency();

    const [searchQuery, setSearchQuery] = useState('');

    const location = useMemo(() => locations.find((l) => l.id === id), [locations, id]);

    if (!location) {
        return (
            <div className="p-6 text-center max-w-3xl mx-auto">
                <p className="text-muted-foreground">Location not found.</p>
                <Button variant="outline" className="mt-4" onClick={() => setLocation('/locations')}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to locations
                </Button>
            </div>
        );
    }

    // Get all products at this location
    const productsAtLocation = useMemo(() => {
        const productIds = new Set<string>();
        const stockByProduct = new Map<string, number>();

        // From locationStocks
        for (const stock of locationStocks) {
            if (stock.locationId === id) {
                productIds.add(stock.productId);
                stockByProduct.set(stock.productId, Number(stock.quantity ?? 0));
            }
        }

        // From supplierStocks fallback
        for (const product of inventory) {
            const stock = getLocationStockForProduct(product, id, locationStocks);
            if (stock > 0) {
                productIds.add(product.id);
                stockByProduct.set(product.id, stock);
            }
        }

        // Get product objects with stock info
        return Array.from(productIds)
            .map((productId) => {
                const product = inventory.find((p) => p.id === productId);
                if (!product) return null;
                return {
                    product,
                    stock: stockByProduct.get(productId) ?? 0,
                };
            })
            .filter((item) => item !== null) as Array<{ product: any; stock: number }>;
    }, [inventory, locationStocks, id]);

    // Filter by search
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return productsAtLocation;
        const q = searchQuery.toLowerCase();
        return productsAtLocation.filter(
            ({ product }) =>
                product.name.toLowerCase().includes(q) ||
                product.category.toLowerCase().includes(q) ||
                (product.brand?.toLowerCase().includes(q) ?? false),
        );
    }, [productsAtLocation, searchQuery]);

    // Get recent movements at this location
    const recentMovements = useMemo(
        () =>
            movements
                .filter((m) => m.sourceLocationId === id || m.destinationLocationId === id)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 5),
        [movements, id],
    );

    const getBatchesForProduct = (productId: string) => {
        return batches
            .filter((b) => b.productId === productId)
            .map((batch) => {
                const locationAllocation = batchLocations.find(
                    (bl) => bl.batchId === batch.id && bl.locationId === id,
                );
                return {
                    batch,
                    quantityAtLocation: locationAllocation?.quantity ?? 0,
                };
            })
            .filter((item) => item.quantityAtLocation > 0);
    };

    const totalStock = filteredProducts.reduce((sum, item) => sum + item.stock, 0);

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => setLocation('/locations')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold">{location.name}</h1>
                        {location.code && (
                            <p className="text-sm text-muted-foreground">Code: {location.code}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setLocation(`/locations/${id}/move-from`)}
                    >
                        Move out →
                    </Button>
                </div>
            </div>

            {/* Location Info */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4 md:gap-6">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Total stock</p>
                            <p className="text-2xl font-bold mt-1">{totalStock}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Products</p>
                            <p className="text-2xl font-bold mt-1">{filteredProducts.length}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Status</p>
                            <Badge className="mt-1" variant={location.isDefault ? 'default' : 'secondary'}>
                                {location.isDefault ? 'Default' : 'Active'}
                            </Badge>
                        </div>
                    </div>
                    {location.notes && (
                        <p className="text-sm text-muted-foreground mt-4 border-t pt-4">{location.notes}</p>
                    )}
                </CardContent>
            </Card>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search products at this location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                />
                {searchQuery && (
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchQuery('')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Stock at Location */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Stock at {location.name}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground text-sm">No products at this location.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredProducts.map(({ product, stock }) => {
                                const batchesHere = getBatchesForProduct(product.id);
                                const isLowStock = stock <= product.minimumStock && stock > 0;
                                const isOutOfStock = stock === 0;

                                return (
                                    <div
                                        key={product.id}
                                        className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-medium text-sm">{product.name}</h4>
                                                    {isOutOfStock && <Badge variant="destructive" className="text-xs">Out</Badge>}
                                                    {isLowStock && (
                                                        <Badge className="text-xs bg-orange-500/10 text-orange-600 border-orange-300">
                                                            <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Low
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {product.category}
                                                    {product.brand ? ` · ${product.brand}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-bold">
                                                    {stock} {product.unit}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Min: {product.minimumStock} {product.unit}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Batch details if applicable */}
                                        {batchesHere.length > 0 && (
                                            <div className="mt-2 pt-2 border-t text-xs">
                                                <p className="text-muted-foreground font-medium mb-1">Batches:</p>
                                                <div className="space-y-1">
                                                    {batchesHere.map(({ batch, quantityAtLocation }) => (
                                                        <div key={batch.id} className="text-xs pl-2 border-l border-muted">
                                                            <span className="font-mono">{batch.batchNumber}</span>
                                                            <span className="text-muted-foreground ml-2">
                                                                {quantityAtLocation} units
                                                                {batch.expiryDate && ` · Exp: ${new Date(batch.expiryDate).toLocaleDateString()}`}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Movements */}
            {recentMovements.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent movements</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentMovements.map((movement) => {
                            const product = inventory.find((p) => p.id === movement.productId);
                            return (
                                <div key={movement.id} className="text-xs border rounded p-2 flex justify-between">
                                    <div>
                                        <p className="font-medium">{movement.quantity} × {product?.name ?? movement.productName}</p>
                                        <p className="text-muted-foreground">
                                            {movement.movementType}
                                        </p>
                                    </div>
                                    <p className="text-muted-foreground">
                                        {new Date(movement.updatedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
