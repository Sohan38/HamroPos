import { useParams, useLocation } from 'wouter';
import { useMemo } from 'react';
import { useLocations, useInventoryLocationStocks, useInventoryMovements } from '@/contexts/GlobalProviders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Eye } from 'lucide-react';

export default function LocationDetail() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const { items: locations } = useLocations();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: movements } = useInventoryMovements();

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
                .slice(0, 3),
        [movements, id],
    );

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 space-y-4">
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
            </div>

            {/* Location Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4" /> Location Overview
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Total stock</p>
                            <p className="text-2xl font-bold mt-1">{totalStock}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Products</p>
                            <p className="text-2xl font-bold mt-1">{productCount}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Status</p>
                            <Badge className="mt-1" variant={location.isDefault ? 'default' : 'secondary'}>
                                {location.isDefault ? 'Default' : 'Active'}
                            </Badge>
                        </div>
                    </div>
                    {location.notes && (
                        <p className="text-sm text-muted-foreground border-t pt-3">{location.notes}</p>
                    )}
                    <div className="border-t pt-4">
                        <Button
                            onClick={() => setLocation(`/inventory?location=${id}`)}
                            className="w-full"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            View Inventory at this Location
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Movements */}
            {recentMovements.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentMovements.map((movement) => (
                            <div key={movement.id} className="text-xs border rounded p-2 flex justify-between">
                                <div>
                                    <p className="font-medium">{movement.quantity} units</p>
                                    <p className="text-muted-foreground">{movement.movementType}</p>
                                </div>
                                <p className="text-muted-foreground">
                                    {new Date(movement.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
