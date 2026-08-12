import { useMemo, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useDispositions, useInventory, useProductBatches, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Search,
    ArrowRight,
    CalendarDays,
    Package,
    Truck,
    FileText,
    Plus,
    X,
    FilterX,
    ClipboardList,
    Boxes,
    Coins,
    GitBranch,
    Calendar,
} from 'lucide-react';
import {
    format as formatDate,
    parseISO,
    subDays,
    startOfWeek,
    startOfMonth,
} from 'date-fns';
import { rankSearch } from '@/utils/search/rank';
import { DispositionResolution, DispositionStatus } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const statuses: Array<{ id: DispositionStatus | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'reversed', label: 'Reversed' },
];

const resolutions: Array<{ id: DispositionResolution | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'return_to_supplier', label: 'Return to supplier' },
    { id: 'supplier_replacement', label: 'Replacement' },
    { id: 'supplier_credit', label: 'Credit' },
    { id: 'supplier_refund', label: 'Refund' },
    { id: 'write_off', label: 'Write off' },
    { id: 'reversal', label: 'Reversal' },
];

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
    { id: 'all', label: 'All Time' },
];

// Helper to get color classes for resolution accent (UI only)
const getResolutionAccent = (resolution: DispositionResolution): string => {
    switch (resolution) {
        case 'return_to_supplier': return 'border-l-blue-500';
        case 'supplier_replacement': return 'border-l-emerald-500';
        case 'supplier_credit': return 'border-l-amber-500';
        case 'supplier_refund': return 'border-l-violet-500';
        case 'write_off': return 'border-l-rose-500';
        case 'reversal': return 'border-l-slate-400';
        default: return 'border-l-gray-300';
    }
};

// Chip component (UI‑only)
interface ChipProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
}

function Chip({ active, onClick, children, className = '' }: ChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
                active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                className,
            ].join(' ')}
        >
            {children}
        </button>
    );
}

export default function DispositionList() {
    const [, setLocation] = useLocation();
    const { items: dispositions } = useDispositions();
    const { items: inventory } = useInventory();
    const { items: batches } = useProductBatches();
    const { items: suppliers } = useSuppliers();
    const { format } = useCurrency();

    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<DispositionStatus | 'all'>('all');
    const [resolutionFilter, setResolutionFilter] = useState<DispositionResolution | 'all'>('all');
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [customOpen, setCustomOpen] = useState(false);
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');

    // Helper to compute date boundaries once per render (cheap)
    const dateBoundaries = useMemo(() => {
        const now = new Date();
        const fmt = (d: Date) => formatDate(d, 'yyyy-MM-dd');
        return {
            today: fmt(now),
            yesterday: fmt(subDays(now, 1)),
            weekStart: fmt(startOfWeek(now, { weekStartsOn: 0 })),
            monthStart: fmt(startOfMonth(now)),
        };
    }, []);

    const processed = useMemo(() => {
        const searchableItems = dispositions.map((item) => {
            const product = inventory.find((product) => product.id === item.productId);
            const supplier = suppliers.find((supplier) => supplier.id === item.supplierId);
            const batch = batches.find((batch) => batch.id === item.batchId);

            const productName = product?.name ?? item.productName;

            return {
                ...item,
                name: productName,
                productName,
                supplierName: supplier?.name ?? item.supplierName ?? 'Unknown',
                batchNumber: batch?.batchNumber ?? item.batchNumber ?? '—',
                searchText: [
                    item.referenceNumber,
                    item.productName,
                    item.batchNumber,
                    item.reason,
                    item.resolution,
                    supplier?.name,
                    item.purchaseInvoiceNumber,
                ].join(' '),
            };
        });

        let filtered = searchableItems;

        // Date filter
        if (datePreset !== 'all') {
            if (datePreset === 'custom') {
                filtered = filtered.filter((item) => {
                    const day = item.date.slice(0, 10);
                    if (customDateFrom && day < customDateFrom) return false;
                    if (customDateTo && day > customDateTo) return false;
                    return true;
                });
            } else {
                const { today, yesterday, weekStart, monthStart } = dateBoundaries;
                filtered = filtered.filter((item) => {
                    const day = item.date.slice(0, 10);
                    switch (datePreset) {
                        case 'today': return day === today;
                        case 'yesterday': return day === yesterday;
                        case 'week': return day >= weekStart;
                        case 'month': return day >= monthStart;
                        default: return true;
                    }
                });
            }
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter((item) => item.status === statusFilter);
        }

        // Resolution filter
        if (resolutionFilter !== 'all') {
            filtered = filtered.filter((item) => item.resolution === resolutionFilter);
        }

        // Search
        if (query.trim()) {
            filtered = rankSearch(filtered, query, filtered.length);
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date));
    }, [
        dispositions,
        inventory,
        batches,
        suppliers,
        query,
        statusFilter,
        resolutionFilter,
        datePreset,
        customDateFrom,
        customDateTo,
        dateBoundaries,
    ]);

    const totalQuantity = processed.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = processed.reduce((sum, item) => sum + item.totalValue, 0);

    const activeFilterCount = [
        datePreset !== 'all',
        statusFilter !== 'all',
        resolutionFilter !== 'all',
        query.trim() !== '',
    ].filter(Boolean).length;

    const clearFilters = useCallback(() => {
        setQuery('');
        setStatusFilter('all');
        setResolutionFilter('all');
        setDatePreset('all');
        setCustomDateFrom('');
        setCustomDateTo('');
        setCustomOpen(false);
    }, []);

    const handleDatePreset = useCallback((p: DatePreset) => {
        if (p === 'custom') {
            setDatePreset('custom');
            setCustomOpen(true);
            return;
        }
        setDatePreset(p);
        setCustomOpen(false);
    }, []);

    const applyCustomDates = useCallback(() => {
        setDatePreset('custom');
        setCustomOpen(false);
    }, []);

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Dispositions</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {dispositions.length} total record{dispositions.length !== 1 ? 's' : ''}
                    </p>
                </div>

            </div>

            {/* Date chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                {DATE_PRESETS.map((p) => (
                    <Chip
                        key={p.id}
                        active={datePreset === p.id}
                        onClick={() => handleDatePreset(p.id)}
                    >
                        {(p.id === 'today' || p.id === 'yesterday') && <Calendar className="h-3 w-3" />}
                        {p.label}
                    </Chip>
                ))}
            </div>

            {/* Status & Resolution chips combined in one row */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                {statuses.map((s) => (
                    <Chip
                        key={s.id}
                        active={statusFilter === s.id}
                        onClick={() => setStatusFilter(s.id)}
                    >
                        {s.label}
                    </Chip>
                ))}
                {/* Divider */}
                <div className="w-px bg-border mx-1 my-1 shrink-0" />
                {resolutions.map((r) => (
                    <Chip
                        key={r.id}
                        active={resolutionFilter === r.id}
                        onClick={() => setResolutionFilter(r.id)}
                    >
                        {r.label}
                    </Chip>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by reference, product, batch, supplier…"
                    className="pl-9 pr-9"
                />
                {query && (
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setQuery('')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Custom Date Dialog */}
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Custom date range</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <label className="text-sm font-medium text-muted-foreground space-y-2 block">
                            <span>From date</span>
                            <Input
                                type="date"
                                value={customDateFrom}
                                onChange={(e) => setCustomDateFrom(e.target.value)}
                            />
                        </label>
                        <label className="text-sm font-medium text-muted-foreground space-y-2 block">
                            <span>To date</span>
                            <Input
                                type="date"
                                value={customDateTo}
                                onChange={(e) => setCustomDateTo(e.target.value)}
                            />
                        </label>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCustomDateFrom('');
                                setCustomDateTo('');
                                setDatePreset('all');
                                setCustomOpen(false);
                            }}
                        >
                            Clear
                        </Button>
                        <Button onClick={applyCustomDates}>Apply</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Summary card */}
            <Card>
                <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <ClipboardList className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="font-bold text-lg leading-tight">{processed.length}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <Boxes className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Qty Moved</p>
                            <p className="font-bold text-lg leading-tight">{totalQuantity}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <Coins className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Value</p>
                            <p className="font-bold text-lg leading-tight tabular-nums">{format(totalValue)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                            <GitBranch className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Resolutions</p>
                            <p className="font-bold text-lg leading-tight">
                                {new Set(processed.map((item) => item.resolution)).size}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results / Empty state */}
            {processed.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center space-y-3">
                        <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
                        <h3 className="text-base font-semibold">No matching dispositions</h3>
                        <p className="text-muted-foreground text-sm">
                            {activeFilterCount > 0
                                ? 'Try a different date, status, resolution, or search term.'
                                : 'No dispositions found for your search.'}
                        </p>
                        {activeFilterCount > 0 && (
                            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
                                <X className="h-3.5 w-3.5 mr-1.5" />
                                Clear filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {processed.map((disposition, index) => {
                        const product = inventory.find((item) => item.id === disposition.productId);
                        const supplier = suppliers.find((item) => item.id === disposition.supplierId);
                        return (
                            <div
                                key={disposition.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setLocation(`/dispositions/${disposition.id}`)}
                                onKeyDown={(e) => e.key === 'Enter' && setLocation(`/dispositions/${disposition.id}`)}
                                className={`
                                    group flex items-center gap-3 rounded-xl border bg-card
                                    px-4 py-3 cursor-pointer border-l-4
                                    hover:bg-muted/40 active:scale-[0.99]
                                    transition-all duration-100 select-none
                                    ${getResolutionAccent(disposition.resolution)}
                                `}
                            >
                                {/* Serial number */}
                                <div className="text-xs text-muted-foreground tabular-nums w-6 text-center shrink-0 font-medium">
                                    {index + 1}
                                </div>

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{disposition.referenceNumber}</span>
                                        <Badge
                                            variant={disposition.status === 'completed' ? 'secondary' : 'destructive'}
                                            className="uppercase text-[10px] tracking-wide"
                                        >
                                            {disposition.status}
                                        </Badge>
                                        <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                                            {disposition.resolution.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>

                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {product?.name ?? disposition.productName} · {disposition.quantity} qty
                                    </p>

                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {formatDate(parseISO(disposition.date), 'h:mm a')}
                                        </span>
                                        <span className="text-muted-foreground/40 text-xs">·</span>
                                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                            <Truck className="h-3 w-3" />
                                            {supplier?.name ?? disposition.supplierName ?? 'No supplier'}
                                        </span>
                                        <span className="text-muted-foreground/40 text-xs">·</span>
                                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            {disposition.batchNumber || 'No batch'}
                                        </span>
                                    </div>
                                </div>

                                {/* Value + arrow */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                        <p className="font-bold tabular-nums text-sm">{format(disposition.totalValue)}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}