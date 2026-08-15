import React, { useMemo, useState, useEffect } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Calendar, MapPin, ChevronRight, ArrowLeft, X, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ConsumptionList() {
    const [, setLocation] = useLocation();
    const goBack = useSmartBack('/dashboard');
    const consumptionEnabled = useFeature('consumption', 'enabled');
    const { items: consumptions } = useConsumptions();
    const { items: locations } = useLocations();

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [filterLocationId, setFilterLocationId] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Debounce search term to avoid filtering/re-rendering on every keystroke
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 200);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Feature check
    if (!consumptionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-6 max-w-md mx-auto text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        The Consumption feature is not enabled in your current license configuration.
                    </p>
                </div>
                <Button onClick={() => setLocation('/dashboard')} variant="outline" className="rounded-xl w-full">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // Performance Optimization: build a map of location names to avoid O(N*M) find calls on render
    const locationMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const loc of locations) {
            map.set(loc.id, loc.name);
        }
        return map;
    }, [locations]);

    // Filter and search
    const filteredConsumptions = useMemo(() => {
        return consumptions
            .filter(c => !c.deletedAt)
            .filter(c => {
                // Search filter (uses debounced state)
                if (debouncedSearchTerm) {
                    const term = debouncedSearchTerm.toLowerCase();
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
    }, [consumptions, debouncedSearchTerm, filterLocationId, filterStatus]);

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-NP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Calculate sum metrics for header overview
    const { totalCost, totalItemsCount } = useMemo(() => {
        return filteredConsumptions.reduce(
            (acc, curr) => {
                if (curr.status === 'completed') {
                    acc.totalCost += curr.totalCost || 0;
                    acc.totalItemsCount += curr.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                }
                return acc;
            },
            { totalCost: 0, totalItemsCount: 0 }
        );
    }, [filteredConsumptions]);

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation('/dashboard')}
                            className="rounded-full hover:bg-muted shrink-0"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">Consumptions</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-10">
                        {locations.length} location{locations.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <Button
                    onClick={() => setLocation('/inventory/consumption/new')}
                    className="gap-2 shadow-sm shrink-0 rounded-xl"
                >
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Consumption</span><span className="sm:hidden">Create</span>
                </Button>
            </div>

            {/* Overview Summary Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <RefreshCw className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">Total Logs</p>
                            <p className="font-extrabold text-base sm:text-lg leading-tight mt-0.5">{filteredConsumptions.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Package className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">Items Consumed</p>
                            <p className="font-extrabold text-base sm:text-lg leading-tight mt-0.5">{totalItemsCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                        <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                            <span className="font-extrabold text-xs">₹</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">Total Cost</p>
                            <p className="font-extrabold text-sm sm:text-base leading-tight mt-0.5 truncate text-foreground">₹{totalCost.toFixed(1)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search reference, product, reason..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-9 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm h-11"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:w-[320px] shrink-0">
                    <Select value={filterLocationId} onValueChange={setFilterLocationId}>
                        <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                            <SelectValue placeholder="All Locations" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="" className="rounded-lg">All Locations</SelectItem>
                            {locations.filter(l => l.status !== 'inactive').map(location => (
                                <SelectItem key={location.id} value={location.id} className="rounded-lg">
                                    {location.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="" className="rounded-lg">All Status</SelectItem>
                            <SelectItem value="completed" className="rounded-lg">Completed</SelectItem>
                            <SelectItem value="reversed" className="rounded-lg">Reversed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Transactions List */}
            {filteredConsumptions.length === 0 ? (
                <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20">
                    <CardContent className="py-16 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <RefreshCw className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">No transactions found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                            {searchTerm || filterLocationId || filterStatus
                                ? 'Try adjusting your search query or filters to find records.'
                                : 'Record and track internal consumption of warehouse or shop items.'}
                        </p>
                        <Button
                            onClick={() => setLocation('/inventory/consumption/new')}
                            className="mt-5 rounded-xl gap-2 border-primary/20 hover:border-primary/50"
                            variant="outline"
                        >
                            <Plus className="h-4 w-4" /> Create First Transaction
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredConsumptions.map(consumption => (
                        <div
                            key={consumption.id}
                            role="button"
                            tabIndex={0}
                            className={`
                                group flex flex-col md:flex-row justify-between gap-4 rounded-2xl border bg-card/40 hover:bg-card
                                p-4 sm:p-5 cursor-pointer select-none border-l-4 transition-all duration-200
                                hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]
                                ${consumption.status === 'completed' ? 'border-l-emerald-500' : 'border-l-rose-500'}
                            `}
                            onClick={() => setLocation(`/inventory/consumption/${consumption.id}`)}
                            onKeyDown={(e) => e.key === 'Enter' && setLocation(`/inventory/consumption/${consumption.id}`)}
                        >
                            <div className="flex-1 min-w-0 space-y-3">
                                {/* Header Details */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                            {consumption.referenceNumber}
                                        </h3>
                                        {consumption.reason ? (
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{consumption.reason}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground mt-0.5 italic">No reason provided</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-lg font-black text-foreground block">
                                            ₹{consumption.totalCost.toFixed(2)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-semibold block">
                                            {consumption.items.length} item{consumption.items.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Meta details */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1.5 border-t border-muted-foreground/5">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(consumption.date)}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {locationMap.get(consumption.locationId) || 'Unknown Location'}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${consumption.status === 'completed'
                                                ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                                                : 'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                                            }`}
                                    >
                                        {consumption.status === 'completed' ? 'Completed' : 'Reversed'}
                                    </Badge>
                                </div>

                                {/* Mini items preview */}
                                <div className="rounded-xl bg-muted/40 p-3 border border-muted-foreground/5 space-y-1.5">
                                    {consumption.items.slice(0, 2).map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs text-foreground/80">
                                            <span className="truncate max-w-50 sm:max-w-xs font-medium">{item.productName}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-muted-foreground">× {item.quantity} {item.unit}</span>
                                                <span className="font-semibold text-foreground">₹{item.totalCost.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {consumption.items.length > 2 && (
                                        <p className="text-[10px] text-muted-foreground font-medium italic pt-1 border-t border-muted-foreground/5">
                                            + {consumption.items.length - 2} more item{consumption.items.length !== 3 ? 's' : ''} in transaction
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Arrow Indicator */}
                            <div className="hidden md:flex items-center justify-center pl-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-8 w-8 text-muted-foreground group-hover:text-primary group-hover:bg-muted transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
