import { useMemo, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Truck,
  Calendar,
  X,
  ChevronDown,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  format as formatDate,
  parseISO,
  subDays,
  startOfMonth,
} from 'date-fns';
import { rankSearch } from '@/utils/search/rank';
import { DateGroupedList } from '@/components/DateGroupedList';

type PurchaseStatusFilter = 'all' | 'received' | 'draft' | 'cancelled';
type PaymentStatusFilter = 'all' | 'paid' | 'partial' | 'unpaid';
type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const PAGE_SIZE = 30;

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
  { id: 'all', label: 'All Time' },
];

const STATUS_FILTERS: Array<{ id: PurchaseStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'received', label: 'Received' },
  { id: 'draft', label: 'Draft' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_FILTERS: Array<{ id: PaymentStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'partial', label: 'Partial' },
  { id: 'unpaid', label: 'Unpaid' },
];

// Helper to derive payment state from invoice fields
function getPaymentState(invoice: any): 'paid' | 'partial' | 'unpaid' {
  if (invoice.paymentStatus) return invoice.paymentStatus;
  if (invoice.paidAmount && invoice.paidAmount > 0) return 'partial';
  return 'unpaid';
}

// Helper to format time from ISO date string
function formatInvoiceTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatDate(date, 'h:mm a');
  } catch {
    return '';
  }
}

// Chip component (shared pattern)
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

export default function PurchaseList() {
  const [, setLocation] = useLocation();
  const { items: purchases } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { format } = useCurrency();

  // Filter state
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset display count when any filter changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [debouncedQuery, statusFilter, paymentFilter, datePreset, customDateFrom, customDateTo]);

  // Derived date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => formatDate(d, 'yyyy-MM-dd');

    switch (datePreset) {
      case 'today':
        return { from: fmt(now), to: fmt(now) };
      case 'yesterday':
        const y = subDays(now, 1);
        return { from: fmt(y), to: fmt(y) };
      case 'week':
        return { from: fmt(subDays(now, 6)), to: fmt(now) };
      case 'month':
        return { from: fmt(startOfMonth(now)), to: fmt(now) };
      case 'custom':
        return { from: customDateFrom, to: customDateTo };
      default:
        return { from: '', to: '' };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  // Process purchases: enrich → date filter → status filter → payment filter → search → sort
  const processedPurchases = useMemo(() => {
    const enriched = purchases.map((invoice) => {
      const supplier = suppliers.find((c) => c.id === invoice.supplierId);
      const supplierName = supplier?.name ?? invoice.supplierName ?? 'Unknown';
      return {
        ...invoice,
        name: supplierName,
        supplierName,
        searchText: [
          invoice.invoiceNumber,
          invoice.referenceNumber,
          supplier?.name,
          invoice.notes,
          ...invoice.items.map((i) => i.productName),
        ].join(' '),
      };
    });

    let filtered = enriched;

    const { from, to } = dateRange;
    if (from || to) {
      filtered = filtered.filter((invoice) => {
        const day = invoice.date.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((invoice) => (invoice.status ?? 'received') === statusFilter);
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter((invoice) => getPaymentState(invoice) === paymentFilter);
    }

    if (debouncedQuery.trim()) {
      filtered = rankSearch(filtered, debouncedQuery, filtered.length);
    }

    return filtered.sort((a, b) => {
      const dateCompare = (b.date ?? '').localeCompare(a.date ?? '');
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [purchases, suppliers, debouncedQuery, statusFilter, paymentFilter, dateRange]);

  // Summary stats
  const summary = useMemo(() => {
    const receivedValue = processedPurchases
      .filter((invoice) => (invoice.status ?? 'received') === 'received')
      .reduce((sum, invoice) => sum + invoice.grandTotal, 0);
    return {
      count: processedPurchases.length,
      receivedValue,
    };
  }, [processedPurchases]);

  // Pagination
  const visiblePurchases = useMemo(
    () => processedPurchases.slice(0, displayCount),
    [processedPurchases, displayCount],
  );

  const hasMore = displayCount < processedPurchases.length;
  const remaining = processedPurchases.length - displayCount;

  const activeFilterCount = [
    debouncedQuery !== '',
    statusFilter !== 'all',
    paymentFilter !== 'all',
    datePreset !== 'all',
  ].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setInputValue('');
    setStatusFilter('all');
    setPaymentFilter('all');
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

  const loadMore = useCallback(() => {
    setDisplayCount((c) => c + PAGE_SIZE);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {purchases.length} total invoice{purchases.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setLocation('/purchases/new')} className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          New Purchase
        </Button>
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

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      {/* Payment status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {PAYMENT_FILTERS.map((p) => (
          <Chip
            key={p.id}
            active={paymentFilter === p.id}
            onClick={() => setPaymentFilter(p.id)}
          >
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Search + clear filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by invoice #, supplier, product…"
            className="pl-9 pr-9"
            aria-label="Search purchases"
          />
          {inputValue && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setInputValue('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Clear
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFilterCount}
            </Badge>
          </Button>
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
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {activeFilterCount > 0 ? 'Matching purchases' : 'Total purchases'}
              </p>
              <p className="font-bold text-lg leading-tight">{summary.count}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-xs text-muted-foreground">
                {activeFilterCount > 0 ? 'Filtered received value' : 'Received value'}
              </p>
              <p className="font-bold text-lg leading-tight text-green-600 tabular-nums">
                {format(summary.receivedValue)}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results / Empty states */}
      {purchases.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No purchases yet</h3>
            <p className="text-muted-foreground text-sm">Start recording purchases to see them here.</p>
            <Button onClick={() => setLocation('/purchases/new')} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Button>
          </CardContent>
        </Card>
      ) : processedPurchases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">No matching purchases</h3>
            <p className="text-muted-foreground text-sm">
              {activeFilterCount > 0
                ? 'Try a different date, status, payment, or search term.'
                : 'No purchases found for your search.'}
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
        <div className="space-y-6">
          <DateGroupedList
            items={visiblePurchases}
            getDate={(invoice) => invoice.date}
            getId={(invoice) => invoice.id}
            getAmount={(invoice) => invoice.grandTotal}
            formatTotal={(total: number) => format(total)}
            itemLabel="invoice"
            renderItem={(invoice) => {
              const supplier = suppliers.find((c) => c.id === invoice.supplierId);
              const status = invoice.status ?? 'received';
              const paymentState = getPaymentState(invoice);
              const time = formatInvoiceTime(invoice.date);

              const paymentBadgeClass =
                paymentState === 'paid'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : paymentState === 'partial'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';

              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/purchases/${invoice.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && setLocation(`/purchases/${invoice.id}`)}
                  className="
                    group flex items-center gap-3 rounded-xl border bg-card
                    px-3 py-3 sm:px-4 sm:py-3 cursor-pointer
                    hover:bg-muted/40 active:scale-[0.99]
                    transition-all duration-100 select-none
                  "
                >
                  {/* Icon */}
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/10">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary/80" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {invoice.invoiceNumber || 'No Ref #'}
                      </span>
                      <Badge
                        variant={
                          status === 'received'
                            ? 'secondary'
                            : status === 'cancelled'
                              ? 'destructive'
                              : 'outline'
                        }
                        className="uppercase text-[9px] tracking-wider px-1.5 py-0 rounded-md font-bold"
                      >
                        {status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {supplier?.name ?? invoice.supplierName ?? 'Unknown supplier'} &middot;{' '}
                      {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                    </p>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`capitalize text-[9px] px-1.5 py-0 h-4 border-none ${paymentBadgeClass}`}>
                        {paymentState}
                      </Badge>
                    </div>
                  </div>

                  {/* Amount + arrow */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <p className="font-bold tabular-nums text-sm text-green-600 dark:text-green-500">
                        {format(invoice.grandTotal)}
                      </p>
                      {time && (
                        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                          {time}
                        </p>
                      )}
                    </div>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </div>
                  </div>
                </div>
              );
            }}
          />

          {/* Load more */}
          {hasMore && (
            <div className="flex flex-col items-center gap-1 pt-2">
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={loadMore}>
                <ChevronDown className="h-4 w-4" />
                Load {Math.min(PAGE_SIZE, remaining)} more
                <span className="text-muted-foreground text-xs">
                  ({remaining} remaining)
                </span>
              </Button>
            </div>
          )}

          {/* End of list */}
          {!hasMore && processedPurchases.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-2">
              All {processedPurchases.length} purchases shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}