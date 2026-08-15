import React, { useMemo } from 'react';
import { useParams } from 'wouter';
import { toast } from 'sonner';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useConsumptions, useLocations, useInventory, useProductBatches, useInventoryLocationStocks, useInventoryMovements } from '@/contexts/GlobalProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ConsumptionService } from '@/services/consumptionService';
import { ArrowLeft, Calendar, MapPin, FileText, RefreshCw, AlertTriangle, ShieldCheck, HelpCircle, Package, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ConsumptionDetail() {
    const goBack = useSmartBack('/inventory/consumption');
    const { id } = useParams<{ id: string }>();
    const { items: consumptions, update: updateConsumption } = useConsumptions();
    const { items: locations } = useLocations();
    const { items: products, update: updateProduct } = useInventory();
    const { items: batches, update: updateBatch } = useProductBatches();
    const { items: locationStocks, update: updateLocationStock } = useInventoryLocationStocks();
    const { add: addMovement } = useInventoryMovements();

    const consumption = useMemo(() => {
        return consumptions.find(c => c.id === id && c.deletedAt === null);
    }, [consumptions, id]);

    if (!consumption) {
        return (
            <div className="p-12 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Transaction Not Found</h3>
                <p className="text-sm text-muted-foreground">The consumption log you are trying to view does not exist or has been removed.</p>
                <Button variant="outline" className="w-full rounded-xl" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Consumption List
                </Button>
            </div>
        );
    }

    const location = useMemo(() => locations.find(l => l.id === consumption.locationId), [locations, consumption.locationId]);
    const isReversible = consumption.status === 'completed';

    const handleReverse = async () => {
        if (!consumption || !isReversible) return;

        const confirmed = window.confirm(
            `Reverse ${consumption.referenceNumber}? The original consumption record will remain in history and the consumed stock will be restored.`
        );

        if (!confirmed) return;

        try {
            const reversal = ConsumptionService.prepareReversal(
                consumption,
                products,
                batches,
                locationStocks
            );

            for (const [productId, productUpdates] of reversal.productUpdates) {
                await updateProduct(productId, productUpdates);
            }

            for (const [batchId, batchUpdates] of reversal.batchUpdates) {
                await updateBatch(batchId, batchUpdates);
            }

            for (const [stockId, stockUpdates] of reversal.stockUpdates) {
                await updateLocationStock(stockId, stockUpdates);
            }

            for (const movement of reversal.reversalMovements) {
                await addMovement(movement);
            }

            await updateConsumption(consumption.id, {
                status: 'reversed',
                updatedAt: new Date().toISOString(),
                version: (consumption.version || 0) + 1,
            });

            toast.success(`Consumption ${consumption.referenceNumber} reversed successfully.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reverse consumption';
            toast.error(message);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={goBack}
                        className="rounded-full hover:bg-muted shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">{consumption.referenceNumber}</h1>
                            <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    consumption.status === 'completed'
                                        ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                                        : 'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                                }`}
                            >
                                {consumption.status === 'completed' ? 'Completed' : 'Reversed'}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Internal Stock Consumption Details</p>
                    </div>
                </div>
            </div>

            {/* Metrics & Overview Row */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Cost</span>
                        <span className="text-xl sm:text-2xl font-extrabold text-foreground mt-1 block">₹{consumption.totalCost.toFixed(2)}</span>
                    </CardContent>
                </Card>
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Items</span>
                        <span className="text-xl sm:text-2xl font-extrabold text-foreground mt-1 block">
                            {consumption.items.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                    </CardContent>
                </Card>
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Product Lines</span>
                        <span className="text-xl sm:text-2xl font-extrabold text-foreground mt-1 block">{consumption.items.length}</span>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Details Card */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-4.5 w-4.5 text-primary" /> Profile Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> Date Logged
                                    </span>
                                    <p className="text-sm font-semibold text-foreground/90">{formatDate(consumption.date)}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" /> Origin Location
                                    </span>
                                    <p className="text-sm font-semibold text-foreground/90">{location?.name || 'Unknown'}</p>
                                </div>
                            </div>

                            {consumption.reason && (
                                <div className="border-t border-muted-foreground/10 pt-3.5">
                                    <span className="text-xs text-muted-foreground font-medium block">Reason for Consumption</span>
                                    <p className="text-sm font-semibold text-foreground/90 mt-1">{consumption.reason}</p>
                                </div>
                            )}

                            {consumption.notes && (
                                <div className="border-t border-muted-foreground/10 pt-3.5">
                                    <span className="text-xs text-muted-foreground font-medium block">Transaction Notes</span>
                                    <p className="text-sm text-foreground/80 mt-1 bg-muted/30 border border-muted-foreground/5 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                                        {consumption.notes}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Items Card */}
                    <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                                <Package className="h-4.5 w-4.5 text-primary" /> Consumed Products
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 divide-y divide-muted-foreground/10">
                            {consumption.items.map((item, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-start gap-4 hover:bg-muted/10 transition-colors">
                                    <div className="min-w-0 space-y-1">
                                        <h4 className="text-sm font-bold text-foreground truncate">{item.productName}</h4>
                                        {item.batchNumber ? (
                                            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 rounded-md border-muted-foreground/10 bg-muted/40">
                                                Batch: {item.batchNumber}
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic">No batch tracking</span>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-sm font-bold text-foreground block">
                                            ₹{item.totalCost.toFixed(2)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground block">
                                            {item.quantity} {item.unit} @ ₹{item.unitCost.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Audit & Reversal Sidebar */}
                <div className="space-y-6">
                    <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-semibold text-foreground">Transaction Audit</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3.5 text-xs">
                            <div className="flex justify-between items-center py-1.5 border-b border-muted-foreground/5">
                                <span className="text-muted-foreground font-medium">Log Version</span>
                                <span className="font-mono text-foreground font-bold">v{consumption.version || 1}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-muted-foreground/5">
                                <span className="text-muted-foreground font-medium">Created</span>
                                <span className="text-foreground/80">{formatDate(consumption.createdAt)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5">
                                <span className="text-muted-foreground font-medium">Last Updated</span>
                                <span className="text-foreground/80">{formatDate(consumption.updatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {isReversible && (
                        <Card className="border border-amber-200/40 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                    <AlertTriangle className="h-4 w-4" /> Reversal Option
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Reversing this record will return all consumed items back to their respective batch stocks and location inventory.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Button
                                    variant="destructive"
                                    onClick={handleReverse}
                                    className="w-full rounded-xl gap-2 font-semibold shadow-sm text-xs bg-amber-600 hover:bg-amber-700 text-white border-none"
                                >
                                    <ArrowRightLeft className="h-3.5 w-3.5" /> Reverse Transaction
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Back Actions */}
            <div className="flex justify-center pt-2">
                <Button onClick={goBack} variant="outline" className="rounded-xl px-6 border-muted-foreground/20 text-muted-foreground hover:bg-muted/80">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Consumption List
                </Button>
            </div>
        </div>
    );
}
