import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useInventory, useInventoryLocationStocks, useInventoryMovements, useLocations } from '@/contexts/GlobalProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft, Activity, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function InventoryMovementsPage() {
    const [, setLocation] = useLocation();
    const { items: inventory } = useInventory();
    const { items: locations } = useLocations();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: movements } = useInventoryMovements();
    const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
    const [selectedMovementType, setSelectedMovementType] = useState<string>('all');

    const locationMap = useMemo(
        () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
        [locations],
    );

    const filteredMovements = useMemo(() => {
        return [...movements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((movement) => {
            if (selectedMovementType !== 'all' && movement.movementType !== selectedMovementType) return false;
            if (selectedLocationId === 'all') return true;
            return movement.sourceLocationId === selectedLocationId || movement.destinationLocationId === selectedLocationId;
        });
    }, [movements, selectedLocationId, selectedMovementType]);

    const totalStockValue = useMemo(
        () => locationStocks.reduce((sum, stock) => sum + Number(stock.quantity ?? 0), 0),
        [locationStocks],
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Stock movements</h1>
                    <p className="text-sm text-muted-foreground">Operational view of location stock and transfer activity.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation('/inventory')}>
                        Back to inventory
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Products tracked</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{inventory.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Location stock rows</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{locationStocks.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Visible quantity</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{totalStockValue}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Movement history</CardTitle>
                    <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                            <SelectTrigger className="w-full sm:w-45">
                                <SelectValue placeholder="All locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All locations</SelectItem>
                                {locations.map((location) => (
                                    <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedMovementType} onValueChange={setSelectedMovementType}>
                            <SelectTrigger className="w-full sm:w-45">
                                <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All types</SelectItem>
                                <SelectItem value="transfer">Transfers</SelectItem>
                                <SelectItem value="purchase">Purchases</SelectItem>
                                <SelectItem value="sale">Sales</SelectItem>
                                <SelectItem value="adjustment">Adjustments</SelectItem>
                                <SelectItem value="disposition">Dispositions</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {filteredMovements.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No movement history yet.</p>
                    ) : (
                        filteredMovements.map((movement) => {
                            const product = inventory.find((item) => item.id === movement.productId);
                            const isTransfer = movement.movementType === 'transfer';
                            const isInbound = movement.destinationLocationId && movement.sourceLocationId !== movement.destinationLocationId;
                            const fromLabel = movement.sourceLocationId ? locationMap[movement.sourceLocationId] ?? movement.sourceLocationId : 'Unknown';
                            const toLabel = movement.destinationLocationId ? locationMap[movement.destinationLocationId] ?? movement.destinationLocationId : 'Unknown';

                            return (
                                <div key={movement.id} className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-muted p-2">
                                            {isTransfer ? (isInbound ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />) : <ArrowLeftRight className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium">{product?.name ?? movement.productName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {movement.movementType} · {movement.quantity} units
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary">{fromLabel}</Badge>
                                        <span>→</span>
                                        <Badge variant="secondary">{toLabel}</Badge>
                                        <Badge variant={movement.status === 'completed' ? 'default' : 'outline'}>{movement.status ?? 'completed'}</Badge>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
