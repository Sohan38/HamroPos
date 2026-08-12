import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useDispositions, useInventory, useProductBatches, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, CalendarDays, Package, Truck, FileText } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { rankSearch } from '@/utils/search/rank';
import { DispositionResolution, DispositionStatus } from '@/types';

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

    const processed = useMemo(() => {
        const searchableItems = dispositions.map(item => {
            const product = inventory.find(product => product.id === item.productId);
            const supplier = suppliers.find(supplier => supplier.id === item.supplierId);
            const batch = batches.find(batch => batch.id === item.batchId);

            return {
                ...item,
                productName: product?.name ?? item.productName,
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

        if (query.trim()) {
            filtered = rankSearch(filtered, query, filtered.length);
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        if (resolutionFilter !== 'all') {
            filtered = filtered.filter(item => item.resolution === resolutionFilter);
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date));
    }, [dispositions, inventory, batches, suppliers, query, statusFilter, resolutionFilter]);

    const totalQuantity = processed.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = processed.reduce((sum, item) => sum + item.totalValue, 0);

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Dispositions</h1>
                    <p className="text-sm text-muted-foreground">Track supplier returns, replacements, credits, refunds, write-offs, and reversals.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {statuses.map((status) => (
                        <Button
                            key={status.id}
                            variant={statusFilter === status.id ? 'secondary' : 'outline'}
                            size="sm"
                            className="capitalize"
                            onClick={() => setStatusFilter(status.id)}
                        >
                            {status.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase">Total dispositions</p>
                        <p className="text-xl font-semibold">{processed.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase">Quantity moved</p>
                        <p className="text-xl font-semibold">{totalQuantity}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase">Value adjusted</p>
                        <p className="text-xl font-semibold">{format(totalValue)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase">Resolutions</p>
                        <p className="text-xl font-semibold">{new Set(processed.map(item => item.resolution)).size}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-10"
                        placeholder="Search dispositions..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <div>
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value as DispositionStatus | 'all')}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statuses.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Select
                        value={resolutionFilter}
                        onValueChange={(value) => setResolutionFilter(value as DispositionResolution | 'all')}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Resolution" />
                        </SelectTrigger>
                        <SelectContent>
                            {resolutions.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {processed.length === 0 ? (
                <Card className="border-dashed border">
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        No dispositions found with the selected filters.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {processed.map((disposition) => {
                        const product = inventory.find(item => item.id === disposition.productId);
                        const supplier = suppliers.find(item => item.id === disposition.supplierId);
                        return (
                            <Card key={disposition.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/dispositions/${disposition.id}`)}>
                                <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_auto] items-start">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                            <span>{formatDate(parseISO(disposition.date), 'dd MMM yyyy')}</span>
                                            <Badge variant={disposition.status === 'completed' ? 'secondary' : 'destructive'} className="uppercase text-[10px]">
                                                {disposition.status}
                                            </Badge>
                                            <Badge variant="outline" className="uppercase text-[10px]">
                                                {disposition.resolution.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                        <h2 className="text-base font-semibold">{disposition.referenceNumber}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {product?.name ?? disposition.productName} · {disposition.quantity} · {supplier?.name ?? disposition.supplierName ?? 'No supplier'}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                            <span>{disposition.batchNumber || 'No batch'}</span>
                                            <span>{disposition.purchaseInvoiceNumber || 'No invoice'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-2">
                                        <p className="text-sm text-muted-foreground">Value</p>
                                        <p className="text-lg font-semibold">{format(disposition.totalValue)}</p>
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            View <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
