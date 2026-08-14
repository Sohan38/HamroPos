import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Truck, Plus, Calendar, ChevronRight, ChevronDown,
  Clock, TrendingDown, CheckCircle2, AlertCircle, ArrowUpFromLine, Receipt, Search, X,
} from 'lucide-react';
import { format as formatDate, subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDateTime, sortByLatestFirst } from '@/lib/date';
import { rankSearch } from '@/utils/search/rank';

type FilterStatus = 'all' | 'unpaid' | 'partial';
type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';

const PAGE_SIZE = 25;

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
  { id: 'all', label: 'All Time' },
];

const STATUS_FILTERS: Array<{ id: FilterStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
];

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

export default function PayablesList() {
  const [, setLocation] = useLocation();
  const { items: purchases } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { format } = useCurrency();

  // Filter state
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [debouncedQuery, statusFilter, datePreset, customDateFrom, customDateTo]);

  // Derived date range from preset (ISO prefix strings)
  const dateRange = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => formatDate(d, 'yyyy-MM-dd');

    switch (datePreset) {
      case 'today':
        return { from: fmt(now), to: fmt(now) };
      case 'yesterday': {
        const y = subDays(now, 1);
        return { from: fmt(y), to: fmt(y) };
      }
      case '7days':
        return { from: fmt(subDays(now, 6)), to: fmt(now) };
      case 'month':
        return { from: fmt(startOfMonth(now)), to: fmt(now) };
      case 'custom':
        return { from: customDateFrom, to: customDateTo };
      default:
        return { from: '', to: '' };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  // Filter invoices that are outstanding (unpaid/partial)
  const filteredInvoices = useMemo(() => {
    // 1. Only unpaid/partial and not cancelled
    let filtered = purchases.filter(p => {
      const paidAmount = Number(p.paidAmount ?? 0);
      const remaining = Math.max(0, Number(p.grandTotal ?? 0) - paidAmount);
      const ps = p.paymentStatus ?? (paidAmount > 0 ? 'partial' : 'unpaid');
      return remaining > 0 && ps !== 'paid' && (p.status ?? 'received') !== 'cancelled';
    });

    // 2. Date filter
    const { from, to } = dateRange;
    if (from || to) {
      filtered = filtered.filter(invoice => {
        const day = invoice.date.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      });
    }

    // 3. Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const paid = Number(invoice.paidAmount ?? 0);
        const ps = invoice.paymentStatus ?? (paid > 0 ? 'partial' : 'unpaid');
        return ps === statusFilter;
      });
    }

    // 4. Enrich with supplier name and search text
    const enriched = filtered.map(invoice => {
      const supplier = suppliers.find(s => s.id === invoice.supplierId);
      const supplierName = supplier?.name || invoice.supplierName || 'Unknown';
      return {
        ...invoice,
        name: supplierName,
        supplierName,
        searchText: [
          supplierName,
          invoice.invoiceNumber,
          invoice.referenceNumber,
          invoice.notes,
          ...invoice.items.map(i => i.productName),
        ].join(' '),
      };
    });

    // 5. Search
    let result = enriched;
    if (debouncedQuery.trim()) {
      result = rankSearch(enriched, debouncedQuery, enriched.length);
    }

    // 6. Sort (for internal use; supplier grouping will re-sort)
    return sortByLatestFirst(result, item => item.date, item => item.createdAt);
  }, [purchases, suppliers, debouncedQuery, statusFilter, dateRange]);

  // Aggregate filtered invoices by supplier
  const supplierSummaries = useMemo(() => {
    const map = new Map<string, {
      supplierId: string;
      supplierName: string;
      invoices: typeof filteredInvoices;
      totalOutstanding: number;
      totalPaid: number;
      totalInvoiceAmount: number;
      oldestDate: string;
      invoiceCount: number;
    }>();

    filteredInvoices.forEach(invoice => {
      const supplierId = invoice.supplierId;
      if (!map.has(supplierId)) {
        map.set(supplierId, {
          supplierId,
          supplierName: invoice.supplierName,
          invoices: [],
          totalOutstanding: 0,
          totalPaid: 0,
          totalInvoiceAmount: 0,
          oldestDate: invoice.date,
          invoiceCount: 0,
        });
      }
      const summary = map.get(supplierId)!;
      const paid = Number(invoice.paidAmount ?? 0);
      const outstanding = Math.max(0, Number(invoice.grandTotal ?? 0) - paid);
      summary.invoices.push(invoice);
      summary.totalOutstanding += outstanding;
      summary.totalPaid += paid;
      summary.totalInvoiceAmount += Number(invoice.grandTotal ?? 0);
      summary.invoiceCount++;
      if (invoice.date < summary.oldestDate) summary.oldestDate = invoice.date;
    });

    // Convert to array and sort by totalOutstanding descending
    return Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [filteredInvoices]);

  // Summary metrics (across all filtered invoices)
  const totalOwed = useMemo(
    () => filteredInvoices.reduce((sum, p) => sum + Math.max(0, p.grandTotal - (p.paidAmount ?? 0)), 0),
    [filteredInvoices]
  );
  const totalPaid = useMemo(
    () => filteredInvoices.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0),
    [filteredInvoices]
  );

  // Pagination for supplier cards
  const visibleSuppliers = useMemo(
    () => supplierSummaries.slice(0, displayCount),
    [supplierSummaries, displayCount]
  );
  const hasMore = displayCount < supplierSummaries.length;
  const remaining = supplierSummaries.length - displayCount;

  const activeFilterCount = [
    debouncedQuery !== '',
    statusFilter !== 'all',
    datePreset !== 'all',
  ].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setInputValue('');
    setStatusFilter('all');
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

  const loadMore = useCallback(() => setDisplayCount(c => c + PAGE_SIZE), []);

  const toggleSupplier = useCallback((supplierId: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }, []);

  const statusConfig = {
    unpaid: {
      label: 'Unpaid',
      className: 'bg-rose-500/10 text-rose-600 border-rose-200/40 dark:border-rose-500/20',
      icon: <Clock className="h-3 w-3" />,
    },
    partial: {
      label: 'Partial',
      className: 'bg-sky-500/10 text-sky-600 border-sky-200/40 dark:border-sky-500/20',
      icon: <TrendingDown className="h-3 w-3" />,
    },
    paid: {
      label: 'Paid',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:border-emerald-500/20',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payables</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Outstanding payments grouped by supplier
          </p>
        </div>
        <Button onClick={() => setLocation('/purchases/new')} className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          New Purchase
        </Button>
      </div>

      {/* Date chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {DATE_PRESETS.map(p => (
          <Chip key={p.id} active={datePreset === p.id} onClick={() => handleDatePreset(p.id)}>
            {(p.id === 'today' || p.id === 'yesterday') && <Calendar className="h-3 w-3" />}
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {STATUS_FILTERS.map(s => (
          <Chip key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {/* Search + clear filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search supplier, invoice, reference…"
            className="pl-9 pr-9"
            aria-label="Search payables"
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

      {/* Custom date dialog */}
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
                onChange={e => setCustomDateFrom(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-muted-foreground space-y-2 block">
              <span>To date</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={e => setCustomDateTo(e.target.value)}
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

      {/* Summary cards */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ArrowUpFromLine className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Owed</p>
              <p className="font-bold text-lg leading-tight text-rose-600 tabular-nums wrap-break-word">
                {format(totalOwed)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-sky-50 dark:bg-sky-500/10 rounded-xl px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid So Far</p>
              <p className="font-bold text-lg leading-tight text-sky-600 tabular-nums wrap-break-word">
                {format(totalPaid)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier list / empty state */}
      {supplierSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500/70" />
            <h3 className="text-lg font-semibold">All Settled!</h3>
            <p className="text-muted-foreground text-sm">
              No pending balances or outstanding invoices found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            {visibleSuppliers.map(summary => {
              const isExpanded = expandedSuppliers.has(summary.supplierId);
              const progressPct = summary.totalInvoiceAmount > 0
                ? Math.min(100, (summary.totalPaid / summary.totalInvoiceAmount) * 100)
                : 0;

              return (
                <Card key={summary.supplierId} className="shadow-sm hover:shadow-md transition-shadow">
                  {/* Supplier summary row */}
                  <div
                    className="p-4 sm:p-5 cursor-pointer flex items-start justify-between gap-3"
                    onClick={() => toggleSupplier(summary.supplierId)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate">
                          {summary.supplierName}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                          <span>{summary.invoiceCount} invoice{summary.invoiceCount !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(new Date(summary.oldestDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-rose-600 text-base sm:text-lg tabular-nums">
                          {format(summary.totalOutstanding)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          of {format(summary.totalInvoiceAmount)}
                        </p>
                      </div>
                      <ChevronDown className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180'
                      )} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="flex justify-between items-end text-xs mb-1">
                      <span className="text-muted-foreground">Payment Progress</span>
                      <span className="font-bold">{progressPct.toFixed(0)}% paid</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          progressPct >= 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-sky-500' : 'bg-rose-500',
                        )}
                        style={{ width: `${Math.max(progressPct, 1.5)}%` }}
                      />
                    </div>
                  </div>

                  {/* Expanded invoices */}
                  {isExpanded && (
                    <div className="border-t border-border/60 divide-y">
                      {summary.invoices.map(invoice => {
                        const paid = Number(invoice.paidAmount ?? 0);
                        const remaining = Math.max(0, Number(invoice.grandTotal ?? 0) - paid);
                        const ps = invoice.paymentStatus ?? (paid > 0 ? 'partial' : 'unpaid');
                        const statusCfg = statusConfig[ps] ?? statusConfig.unpaid;

                        return (
                          <div
                            key={invoice.id}
                            className="p-4 sm:px-5 hover:bg-muted/40 cursor-pointer transition-colors"
                            onClick={() => setLocation(`/payables/${invoice.id}`)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                                    {invoice.invoiceNumber || 'No Ref#'}
                                  </span>
                                  <Badge variant="outline" className={cn('flex items-center gap-1 px-2 py-0 text-[10px] font-semibold rounded-full border', statusCfg.className)}>
                                    {statusCfg.icon}
                                    {statusCfg.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDateTime(invoice.date)}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm text-rose-600">{format(remaining)}</p>
                                <p className="text-xs text-muted-foreground">of {format(invoice.grandTotal)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex flex-col items-center gap-1 pt-2">
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={loadMore}>
                <ChevronDown className="h-4 w-4" />
                Load {Math.min(PAGE_SIZE, remaining)} more
                <span className="text-muted-foreground text-xs">({remaining} remaining)</span>
              </Button>
            </div>
          )}

          {/* End of list */}
          {!hasMore && supplierSummaries.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-2">
              All {supplierSummaries.length} suppliers shown
            </p>
          )}
        </div>
      )}

      {supplierSummaries.length > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/40">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/80" />
            Click a supplier to view invoices
          </span>
        </div>
      )}
    </div>
  );
}