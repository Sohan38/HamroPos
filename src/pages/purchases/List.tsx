import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Truck, Calendar, Package, Filter, Clock, CheckCircle2, TrendingDown } from 'lucide-react';
import { format as formatDate, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDateTime, sortByLatestFirst } from '@/lib/date';
import { rankSearch } from '@/utils/search/rank';

type FilterStatus = 'all' | 'received' | 'draft' | 'cancelled';
type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';

export default function PurchaseList() {
  const [, setLocation] = useLocation();
  const { items } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { format } = useCurrency();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ];

  const applyDatePreset = (preset: DatePreset) => {
    const today = new Date();

    if (preset === 'custom') {
      setCustomDateFrom(dateFrom);
      setCustomDateTo(dateTo);
      setDatePreset('custom');
      setCustomOpen(true);
      return;
    }

    if (preset === 'all') {
      setDatePreset('all');
      setDateFrom('');
      setDateTo('');
      return;
    }

    const start = preset === 'today'
      ? startOfDay(today)
      : preset === 'yesterday'
        ? startOfDay(subDays(today, 1))
        : preset === '7days'
          ? startOfDay(subDays(today, 6))
          : startOfMonth(today);

    const end = endOfDay(today);
    setDatePreset(preset);
    setDateFrom(formatDate(start, 'yyyy-MM-dd'));
    setDateTo(formatDate(end, 'yyyy-MM-dd'));
  };

  const applyCustomDates = () => {
    setDatePreset('custom');
    setDateFrom(customDateFrom);
    setDateTo(customDateTo);
    setCustomOpen(false);
  };

  const matchesDateRange = (value: string) => {
    const candidate = parseISO(value);
    const fromDate = dateFrom ? startOfDay(parseISO(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(parseISO(dateTo)) : null;

    if (fromDate && candidate < fromDate) return false;
    if (toDate && candidate > toDate) return false;
    return true;
  };

  const processedPurchases = useMemo(() => {
    const searchableItems = items.map(invoice => {
      const supplier = suppliers.find(candidate => candidate.id === invoice.supplierId);
      return {
        ...invoice,
        name: invoice.invoiceNumber || supplier?.name || invoice.referenceNumber || 'Purchase',
        phone: supplier?.phone,
        category: invoice.notes || invoice.items.map(item => item.productName).join(', '),
      };
    });

    let results = searchableItems;
    if (query.trim()) {
      results = rankSearch(searchableItems, query, items.length);
    }

    if (statusFilter !== 'all') {
      results = results.filter(invoice => (invoice.status ?? 'received') === statusFilter);
    }

    if (dateFrom || dateTo) {
      results = results.filter(invoice => matchesDateRange(invoice.date));
    }

    return sortByLatestFirst(results, item => item.date, item => item.createdAt);
  }, [items, suppliers, query, statusFilter, dateFrom, dateTo]);

  const totalValue = processedPurchases
    .filter(invoice => (invoice.status ?? 'received') === 'received')
    .reduce((sum, invoice) => sum + invoice.grandTotal, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Purchases</h1>
          <p className="text-muted-foreground">{items.length} invoices · {format(totalValue)} received</p>
        </div>
        <Button onClick={() => setLocation('/purchases/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> New Purchase
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice, supplier, or product..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 bg-card rounded-xl border-border"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyDatePreset(preset.id)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap',
                  datePreset === preset.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
          {(['all', 'received', 'draft', 'cancelled'] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap capitalize',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border',
              )}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom date range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="text-sm font-medium text-muted-foreground space-y-2 block">
              <span>From date</span>
              <Input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-muted-foreground space-y-2 block">
              <span>To date</span>
              <Input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} />
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); setDatePreset('all'); setDateFrom(''); setDateTo(''); setCustomOpen(false); }}>
              Clear
            </Button>
            <Button onClick={applyCustomDates}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No purchases found</h3>
        </div>
      ) : processedPurchases.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed">
          <Filter className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold">No matching purchases</h3>
          <p className="text-sm text-muted-foreground mt-1">Try a different invoice, supplier, or product name.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {processedPurchases.map((invoice) => {
            const supplier = suppliers.find(candidate => candidate.id === invoice.supplierId);
            const status = invoice.status ?? 'received';
            const paymentState = invoice.paymentStatus ?? (invoice.paidAmount && invoice.paidAmount > 0 ? 'partial' : 'unpaid');
            const paymentBadgeClass = paymentState === 'paid'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : paymentState === 'partial'
                ? 'bg-sky-100 text-sky-700 border-sky-300'
                : 'bg-amber-100 text-amber-700 border-amber-300';
            return (
              <Card key={invoice.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setLocation(`/purchases/${invoice.id}`)}>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {invoice.invoiceNumber || 'No Ref #'}
                        <Badge className={`capitalize text-[10px] ${status === 'received' ? 'bg-green-100 text-green-700 border-green-300' : status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>{status}</Badge>
                      </div>
                      <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(invoice.date)} • {supplier?.name ?? invoice.supplierName ?? 'Unknown supplier'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Package className="h-3 w-3" /> {invoice.items.length} product{invoice.items.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                    <div className="font-bold text-lg text-green-600">{format(invoice.grandTotal)}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`capitalize text-xs ${paymentBadgeClass}`}>
                        {paymentState}
                      </Badge>
                      <Badge className={`capitalize text-[10px] ${status === 'received' ? 'bg-green-100 text-green-700 border-green-300' : status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                        {status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}
