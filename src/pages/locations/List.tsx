import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useLocations, useInventory, useInventoryLocationStocks, useInventoryMovements } from '@/contexts/GlobalProviders';
import { getLocationStockForProduct, getProductLocationStockSummary } from '@/lib/locationStock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Package, Plus, Search, X } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

export default function LocationsList() {
    const [, setLocation] = useLocation();
    const { items: locations } = useLocations();
    const { items: inventory } = useInventory();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: movements } = useInventoryMovements();
    const { format } = useCurrency();

    const [searchQuery, setSearchQuery] = useState('');

    // Only show active locations
    const activeLocations = useMemo(
        () => locations.filter((loc) => (loc.status ?? 'active') !== 'inactive'),
        [locations],
    );

    // Filter by search
    const filteredLocations = useMemo(() => {
        if (!searchQuery.trim()) return activeLocations;
        const q = searchQuery.toLowerCase();
        return activeLocations.filter(
            (loc) =>
                loc.name.toLowerCase().includes(q) ||
                (loc.code?.toLowerCase().includes(q) ?? false) ||
                (loc.notes?.toLowerCase().includes(q) ?? false),
        );
    }, [activeLocations, searchQuery]);

    // Compute location metrics
    const locationMetrics = useMemo(() => {
        return filteredLocations.map((location) => {
            const stockAtLocation = locationStocks
                .filter((stock) => stock.locationId === location.id)
                .reduce((sum, stock) => sum + Number(stock.quantity ?? 0), 0);

            const productsAtLocation = new Set(
                locationStocks
                    .filter((stock) => stock.locationId === location.id)
                    .map((stock) => stock.productId),
            );

            const recentMovements = movements
                .filter((m) => m.sourceLocationId === location.id || m.destinationLocationId === location.id)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 1);

            return {
                location,
                stockQuantity: stockAtLocation,
                productCount: productsAtLocation.size,
                lastMovement: recentMovements[0],
            };
        });
    }, [filteredLocations, locationStocks, movements]);

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-bold">Locations</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Manage and view stock at each location.</p>
                </div>
                <Button onClick={() => setLocation('/locations/move-stock')} className="gap-2">
                    <Plus className="h-4 w-4" /> Move Stock
                </Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search locations..."
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

            {/* Locations Grid */}
            {locationMetrics.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">No locations found.</p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => setLocation('/settings?tab=locations')}
                        >
                            Create a location
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {locationMetrics.map(({ location, stockQuantity, productCount, lastMovement }) => (
                        <Card
                            key={location.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setLocation(`/locations/${location.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base">{location.name}</CardTitle>
                                        {location.code && (
                                            <p className="text-xs text-muted-foreground mt-1">Code: {location.code}</p>
                                        )}
                                    </div>
                                    {location.isDefault && (
                                        <Badge variant="secondary" className="text-xs">Default</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Stock metrics */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg bg-muted/50 p-3">
                                        <div className="text-xs text-muted-foreground font-medium">Stock quantity</div>
                                        <div className="text-lg font-bold mt-1">{stockQuantity}</div>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-3">
                                        <div className="text-xs text-muted-foreground font-medium">Products</div>
                                        <div className="text-lg font-bold mt-1">{productCount}</div>
                                    </div>
                                </div>

                                {/* Recent activity */}
                                {lastMovement ? (
                                    <div className="text-xs text-muted-foreground border-t pt-2">
                                        <p className="font-medium">Last moved:</p>
                                        <p className="mt-1">
                                            {lastMovement.quantity} × {inventory.find((i) => i.id === lastMovement.productId)?.name ?? '?'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground border-t pt-2">No movements yet.</div>
                                )}

                                <Button
                                    variant="outline"
                                    className="w-full text-xs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLocation(`/locations/${location.id}`);
                                    }}
                                >
                                    View details →
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
