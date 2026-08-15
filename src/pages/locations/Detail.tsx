import { useParams, useLocation } from 'wouter';
import { useMemo } from 'react';
import { useLocations, useInventoryLocationStocks, useInventoryMovements, useInventory } from '@/contexts/GlobalProviders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Eye, Calendar, Package, ArrowRightLeft, FileText, ChevronRight } from 'lucide-react';

export default function LocationDetail() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const { items: locations } = useLocations();
    const { items: inventory } = useInventory();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: movements } = useInventoryMovements();

    const location = useMemo(() => locations.find((l) => l.id === id), [locations, id]);

    if (!location) {
        return (
            <div className="p-12 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Location Not Found</h3>
                <p className="text-sm text-muted-foreground">The location you are trying to view does not exist or has been removed.</p>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setLocation('/locations')}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Locations
                </Button>
            </div>
        );
    }

    // Calculate location metrics
    const totalStock = locationStocks
        .filter((stock) => stock.locationId === id)
        .reduce((sum, stock) => sum + Number(stock.quantity ?? 0), 0);

    const productCount = new Set(
        locationStocks
            .filter((stock) => stock.locationId === id)
            .map((stock) => stock.productId),
    ).size;

    const recentMovements = useMemo(
        () =>
            movements
                .filter((m) => m.sourceLocationId === id || m.destinationLocationId === id)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 5),
        [movements, id],
    );

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLocation('/locations')}
                        className="rounded-full hover:bg-muted shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">{location.name}</h1>
                            {location.isDefault && (
                                <Badge variant="default" className="text-[10px] px-2 py-0.5 rounded-md font-medium shadow-sm">Default</Badge>
                            )}
                        </div>
                        {location.code && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">Code: {location.code}</p>
                        )}
                    </div>
                </div>
                <Button
                    onClick={() => setLocation(`/inventory?location=${id}`)}
                    className="gap-2 shadow-sm rounded-xl shrink-0"
                >
                    <Eye className="h-4 w-4" /> View Live Inventory
                </Button>
            </div>

            {/* Layout Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Metrics & Overview Cards */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                                <MapPin className="h-4.5 w-4.5 text-primary" /> Location Profile
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-xl bg-muted/40 p-3.5 border border-muted-foreground/5 text-center">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Stock</span>
                                    <span className="text-2xl font-extrabold text-foreground mt-1 block">{totalStock}</span>
                                </div>
                                <div className="rounded-xl bg-muted/40 p-3.5 border border-muted-foreground/5 text-center">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Unique Products</span>
                                    <span className="text-2xl font-extrabold text-foreground mt-1 block">{productCount}</span>
                                </div>
                                <div className="rounded-xl bg-muted/40 p-3.5 border border-muted-foreground/5 text-center">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Status</span>
                                    <div className="mt-2 block">
                                        <Badge className="text-[10px] px-2 py-0.5 rounded-md font-medium" variant={location.status === 'inactive' ? 'destructive' : 'secondary'}>
                                            {location.status === 'inactive' ? 'Inactive' : 'Active'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {location.notes && (
                                <div className="border-t border-muted-foreground/10 pt-4 space-y-1.5">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" /> Location Notes
                                    </span>
                                    <p className="text-sm text-foreground/80 bg-muted/30 rounded-xl p-3.5 border border-muted-foreground/5 leading-relaxed">
                                        {location.notes}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar - Quick info & Details */}
                <div className="space-y-6">
                    <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-semibold text-foreground">Location Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-muted-foreground/5">
                                <span className="text-muted-foreground font-medium">Internal ID</span>
                                <span className="font-mono text-xs text-foreground/80 bg-muted px-2 py-1 rounded-md">{location.id.slice(0, 8)}...</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-muted-foreground/5">
                                <span className="text-muted-foreground font-medium">Type</span>
                                <span className="text-foreground/80 font-medium">{location.isDefault ? 'Primary Warehouse' : 'Standard Location'}</span>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full rounded-xl text-xs gap-1.5 border-primary/10 hover:border-primary/30 mt-2"
                                onClick={() => setLocation('/locations/move-stock')}
                            >
                                <ArrowRightLeft className="h-3.5 w-3.5 text-primary" /> Transfer Stock to/from Here
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Recent Movements / Activity Logs */}
            <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        <ArrowRightLeft className="h-4.5 w-4.5 text-primary" /> Recent Location Activity
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {recentMovements.length > 0 ? (
                        <div className="divide-y divide-muted-foreground/10">
                            {recentMovements.map((movement) => {
                                const prod = inventory.find((i) => i.id === movement.productId);
                                const isSource = movement.sourceLocationId === id;
                                return (
                                    <div key={movement.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isSource ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{prod?.name ?? movement.productName ?? 'Unknown Product'}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                    <span className="capitalize font-medium">{movement.movementType}</span>
                                                    <span>•</span>
                                                    {isSource ? (
                                                        <span>Sent out from this location</span>
                                                    ) : (
                                                        <span>Received into this location</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 shrink-0 pl-11 sm:pl-0">
                                            <Badge variant={isSource ? 'outline' : 'default'} className={`text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm ${isSource ? 'border-rose-200 text-rose-600 bg-rose-50/50' : ''}`}>
                                                {isSource ? '-' : '+'}{movement.quantity} units
                                            </Badge>
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="h-3 w-3" /> {new Date(movement.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground/60 italic text-sm">
                            No movements recorded for this location yet.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
