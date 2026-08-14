import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useFeature } from '@/hooks/useFeature';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useConsumptions, useLocations } from '@/contexts/GlobalProviders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Calendar, MapPin, MoreVertical } from 'lucide-react';

export function ConsumptionList() {
    const [, setLocation] = useLocation();
    const goBack = useSmartBack('/dashboard');
    const consumptionEnabled = useFeature('consumption', 'enabled');
    const { items: consumptions } = useConsumptions();
    const { items: locations } = useLocations();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocationId, setFilterLocationId] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Feature check
    if (!consumptionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">Access Denied</h2>
                    <p className="text-muted-foreground mt-2">
                        Consumption feature is not enabled in your license.
                    </p>
                </div>
                <Button onClick={() => setLocation('/dashboard')} variant="outline">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // Filter and search
    const filteredConsumptions = useMemo(() => {
        return consumptions
            .filter(c => c.deletedAt === null)
            .filter(c => {
                // Search filter
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return (
                        c.referenceNumber.toLowerCase().includes(term) ||
                        c.items.some(item => item.productName.toLowerCase().includes(term)) ||
                        c.reason?.toLowerCase().includes(term) ||
                        c.notes?.toLowerCase().includes(term)
                    );
                }
                return true;
            })
            .filter(c => {
                // Location filter
                if (filterLocationId && c.locationId !== filterLocationId) {
                    return false;
                }
                return true;
            })
            .filter(c => {
                // Status filter
                if (filterStatus && c.status !== filterStatus) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [consumptions, searchTerm, filterLocationId, filterStatus]);

    // Get location name
    const getLocationName = (locationId: string) => {
        return locations.find(l => l.id === locationId)?.name || 'Unknown';
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Consumption Transactions</h1>
                        <p className="text-muted-foreground">
                            {filteredConsumptions.length} transaction{filteredConsumptions.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Button onClick={() => setLocation('/inventory/consumption/new')} size="lg">
                        <Plus className="h-4 w-4 mr-2" />
                        New Consumption
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search by reference, product, reason..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Select value={filterLocationId} onValueChange={setFilterLocationId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Locations</SelectItem>
                                    {locations.filter(l => (l.status ?? 'active') !== 'inactive').map(location => (
                                        <SelectItem key={location.id} value={location.id}>
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Status</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="reversed">Reversed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Transactions List */}
                {filteredConsumptions.length === 0 ? (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center space-y-4">
                                <h3 className="text-lg font-medium">No consumption transactions found</h3>
                                <p className="text-muted-foreground">
                                    {searchTerm || filterLocationId || filterStatus
                                        ? 'Try adjusting your filters or search'
                                        : 'Start by creating a new consumption transaction'}
                                </p>
                                <Button onClick={() => setLocation('/inventory/consumption/new')} variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create First Transaction
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredConsumptions.map(consumption => (
                            <Card
                                key={consumption.id}
                                className="cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => setLocation(`/inventory/consumption/${consumption.id}`)}
                            >
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-4">
                                            {/* Header row */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-lg font-bold">{consumption.referenceNumber}</h3>
                                                    {consumption.reason && (
                                                        <p className="text-sm text-muted-foreground mt-1">{consumption.reason}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-primary">
                                                        ₹{consumption.totalCost.toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {consumption.items.length} item{consumption.items.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Meta information */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>{formatDate(consumption.date)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{getLocationName(consumption.locationId)}</span>
                                                </div>
                                                <div>
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${consumption.status === 'completed'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {consumption.status === 'completed' ? 'Completed' : 'Reversed'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Items preview */}
                                            <div className="bg-muted/50 rounded px-3 py-2">
                                                <p className="text-xs font-medium text-muted-foreground mb-1">Items:</p>
                                                <div className="space-y-1">
                                                    {consumption.items.slice(0, 3).map((item, idx) => (
                                                        <div key={idx} className="text-sm">
                                                            <span>{item.productName}</span>
                                                            <span className="text-muted-foreground"> × {item.quantity} {item.unit}</span>
                                                            <span className="float-right font-medium">₹{item.totalCost.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                    {consumption.items.length > 3 && (
                                                        <div className="text-xs text-muted-foreground italic">
                                                            +{consumption.items.length - 3} more items
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="ml-4"
                                            onClick={e => {
                                                e.stopPropagation();
                                            }}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
