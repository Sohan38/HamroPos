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

    // Calculate aggregated metrics for the summary cards
    const { totalActiveStock, totalActiveProducts, defaultLocName } = useMemo(() => {
        const activeStock = locationStocks
            .filter((stock) => {
                const loc = locations.find((l) => l.id === stock.locationId);
                return loc && (loc.status ?? 'active') !== 'inactive';
            })
            .reduce((sum, stock) => sum + Number(stock.quantity ?? 0), 0);

        const uniqueProducts = new Set(
            locationStocks
                .filter((stock) => {
                    const loc = locations.find((l) => l.id === stock.locationId);
                    return loc && (loc.status ?? 'active') !== 'inactive';
                })
                .map((stock) => stock.productId)
        ).size;

        const defaultLoc = locations.find((l) => l.isDefault && (l.status ?? 'active') !== 'inactive');

        return {
            totalActiveStock: activeStock,
            totalActiveProducts: uniqueProducts,
            defaultLocName: defaultLoc ? defaultLoc.name : 'None',
        };
    }, [locationStocks, locations]);

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation('/')}
                            className="rounded-full hover:bg-muted/80 shrink-0"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight truncate">Locations</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-10">
                        {locations.length} location{locations.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <Button
                    onClick={() => setLocation('/locations/move-stock')}
                    className="gap-2 shadow-sm shrink-0 rounded-xl"
                >
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Move Stock</span><span className="sm:hidden">Move</span>
                </Button>
            </div>

            {/* Metrics cards (consistent with dispositions) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <MapPin className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-medium truncate">Total Locations</p>
                            <p className="font-bold text-base sm:text-lg leading-tight mt-0.5">{activeLocations.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Package className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-medium truncate">Total Stock</p>
                            <p className="font-bold text-base sm:text-lg leading-tight mt-0.5">{totalActiveStock}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Package className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-medium truncate">Unique Products</p>
                            <p className="font-bold text-base sm:text-lg leading-tight mt-0.5">{totalActiveProducts}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm col-span-2 md:col-span-1">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                            <MapPin className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground font-medium truncate">Default Location</p>
                            <p className="font-bold text-sm sm:text-base leading-tight mt-0.5 truncate text-foreground">{defaultLocName}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search locations by name, code, or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm h-11"
                />
                {searchQuery && (
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setSearchQuery('')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Locations Grid */}
            {locationMetrics.length === 0 ? (
                <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20">
                    <CardContent className="py-16 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <MapPin className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">No locations found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                            Try adjusting your search terms or create a new location configuration.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-5 rounded-xl gap-2 border-primary/20 hover:border-primary/50"
                            onClick={() => setLocation('/settings?tab=locations')}
                        >
                            Create a location
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {locationMetrics.map(({ location, stockQuantity, productCount, lastMovement }) => (
                        <div
                            key={location.id}
                            role="button"
                            tabIndex={0}
                            className={`
                                group flex flex-col justify-between rounded-2xl border bg-card/40 hover:bg-card
                                p-4 cursor-pointer select-none border-l-4 transition-all duration-200
                                hover:shadow-md hover:-translate-y-[2px] active:scale-[0.99]
                                ${location.isDefault ? 'border-l-primary' : 'border-l-muted-foreground/30'}
                            `}
                            onClick={() => setLocation(`/locations/${location.id}`)}
                            onKeyDown={(e) => e.key === 'Enter' && setLocation(`/locations/${location.id}`)}
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                            {location.name}
                                        </h3>
                                        {location.code ? (
                                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">Code: {location.code}</p>
                                        ) : (
                                            <div className="h-4.5" />
                                        )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {location.isDefault && (
                                            <Badge variant="default" className="text-[10px] px-2 py-0.5 shadow-sm rounded-md font-medium">Default</Badge>
                                        )}
                                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md font-medium border-muted-foreground/10 bg-muted/30">Active</Badge>
                                    </div>
                                </div>

                                {/* Stock metrics */}
                                <div className="grid grid-cols-2 gap-3.5 my-3">
                                    <div className="rounded-xl bg-muted/40 p-2.5 border border-muted-foreground/5 text-center sm:text-left">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Stock Qty</span>
                                        <span className="text-lg font-extrabold text-foreground mt-0.5 block">{stockQuantity}</span>
                                    </div>
                                    <div className="rounded-xl bg-muted/40 p-2.5 border border-muted-foreground/5 text-center sm:text-left">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Products</span>
                                        <span className="text-lg font-extrabold text-foreground mt-0.5 block">{productCount}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 pt-3 border-t border-muted-foreground/10">
                                {/* Recent activity */}
                                {lastMovement ? (
                                    <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5 min-w-0 mb-3">
                                        <span className="font-semibold text-foreground/80">Last Movement:</span>
                                        <span className="truncate text-foreground/70">
                                            {lastMovement.quantity} × {inventory.find((i) => i.id === lastMovement.productId)?.name ?? '?'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-muted-foreground italic mb-3">No stock transfers logged yet.</div>
                                )}

                                <Button
                                    variant="ghost"
                                    className="w-full text-xs h-9 justify-between group-hover:bg-muted/80 rounded-xl px-3 text-muted-foreground group-hover:text-primary transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLocation(`/locations/${location.id}`);
                                    }}
                                >
                                    <span>View location details</span>
                                    <span className="transition-transform group-hover:translate-x-1">→</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
