import React, { useMemo } from 'react';
import { useParams } from 'wouter';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useConsumptions, useLocations } from '@/contexts/GlobalProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, MapPin, FileText } from 'lucide-react';

export function ConsumptionDetail() {
    const goBack = useSmartBack('/inventory/consumption');
    const { id } = useParams<{ id: string }>();
    const { items: consumptions } = useConsumptions();
    const { items: locations } = useLocations();

    const consumption = useMemo(() => {
        return consumptions.find(c => c.id === id && c.deletedAt === null);
    }, [consumptions, id]);

    if (!consumption) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Transaction Not Found</h2>
                    <p className="text-muted-foreground mt-2">
                        The consumption transaction you're looking for doesn't exist.
                    </p>
                </div>
                <Button onClick={goBack} variant="outline">
                    Back to Consumption
                </Button>
            </div>
        );
    }

    const location = locations.find(l => l.id === consumption.locationId);
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{consumption.referenceNumber}</h1>
                        <p className="text-muted-foreground">Consumption Transaction Details</p>
                    </div>
                </div>

                {/* Summary Card */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                                <p className="text-3xl font-bold">₹{consumption.totalCost.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Items</p>
                                <p className="text-3xl font-bold">{consumption.items.length}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Status</p>
                                <p className="text-xl font-bold capitalize">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${consumption.status === 'completed'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}
                                    >
                                        {consumption.status === 'completed' ? 'Completed' : 'Reversed'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Details Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Date</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-base">{formatDate(consumption.date)}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Location</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-base">{location?.name || 'Unknown'}</p>
                                </div>
                            </div>
                        </div>
                        {consumption.reason && (
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                                <p className="text-base mt-1">{consumption.reason}</p>
                            </div>
                        )}
                        {consumption.notes && (
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                                <p className="text-base mt-1 text-wrap">{consumption.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Items Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Consumed Items</CardTitle>
                        <CardDescription>{consumption.items.length} item{consumption.items.length !== 1 ? 's' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {consumption.items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="border rounded-lg p-4 space-y-2 bg-muted/30"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium">{item.productName}</h4>
                                            {item.batchNumber && (
                                                <p className="text-sm text-muted-foreground mt-1">Batch: {item.batchNumber}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold">₹{item.totalCost.toFixed(2)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.quantity} {item.unit}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-primary/10 rounded px-3 py-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Cost per unit: ₹{item.unitCost.toFixed(2)}</span>
                                            <span>Quantity: {item.quantity} {item.unit}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Metadata */}
                <Card className="text-xs text-muted-foreground">
                    <CardContent className="pt-6 space-y-2">
                        <div className="flex justify-between">
                            <span>Created: {formatDate(consumption.createdAt)}</span>
                            <span>Last Updated: {formatDate(consumption.updatedAt)}</span>
                        </div>
                        <div>Reference ID: {consumption.id}</div>
                    </CardContent>
                </Card>

                {/* Back Button */}
                <div className="flex justify-center pt-4">
                    <Button onClick={goBack} variant="outline">
                        Back to Consumption List
                    </Button>
                </div>
            </div>
        </div>
    );
}
