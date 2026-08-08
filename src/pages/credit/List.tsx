import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useCredit } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Banknote, Plus, Calendar, User, ChevronRight, CheckCircle2,
  Clock, TrendingDown, Search, Filter, Phone, Trash2
} from 'lucide-react';
import { format as formatDate, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDateTime, sortByLatestFirst } from '@/lib/date';
import { rankSearch } from '@/utils/search/rank';

type FilterStatus = 'all' | 'pending' | 'partial' | 'paid';
type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';

export default function CreditList() {
  const [, setLocation] = useLocation();
  const { items } = useCredit();
  const { format } = useCurrency();

  const [searchQuery, setSearchQuery] = useState('');
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

  const totalPending = items
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + Math.max(0, i.amount - (i.paidAmount ?? 0)), 0);
  const totalReceived = items
    .reduce((s, i) => s + (i.paidAmount ?? 0) + (i.status === 'paid' && !i.paidAmount ? i.amount : 0), 0);

  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-orange-500/10 text-orange-600 border-orange-200',
      icon: <Clock className="h-3 w-3" />,
    },
    partial: {
      label: 'Partial',
      className: 'bg-blue-500/10 text-blue-600 border-blue-200',
      icon: <TrendingDown className="h-3 w-3" />,
    },
    paid: {
      label: 'Settled',
      className: 'bg-green-500/10 text-green-600 border-green-200',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };

  // 1. Filter, Search and Sort Credit Invoices
  const processedCredits = useMemo(() => {
    // Map items to match SearchableItem layout so rankSearch can process them
    const searchableItems = items.map(credit => ({
      ...credit,
      name: credit.customerName,
      phone: credit.phone,
      category: credit.description,
    }));

    // Apply query search with ranking/scores if query is provided
    let results = searchableItems;
    if (searchQuery.trim()) {
      results = rankSearch(searchableItems, searchQuery, items.length);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      results = results.filter(c => c.status === statusFilter);
    }

    if (dateFrom || dateTo) {
      results = results.filter(c => matchesDateRange(c.date));
    }

    return sortByLatestFirst(results, item => item.date, item => item.createdAt);
  }, [items, searchQuery, statusFilter, dateFrom, dateTo]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Credit (Udharo)</h1>
          <p className="text-sm text-muted-foreground mt-1">Track customer debts and payment installments</p>
        </div>
        <Button onClick={() => setLocation('/credit/new')} className="w-full sm:w-auto h-11 px-5 shadow-sm rounded-xl gap-2 font-medium shrink-0">
          <Plus className="h-4 w-4" /> Add Credit
        </Button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-orange-500/10 bg-orange-500/2 dark:bg-orange-500/1 rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-orange-700/80 uppercase tracking-wider">Total Pending</p>
              <h2 className="text-2xl md:text-3xl font-black text-orange-600 mt-1">{format(totalPending)}</h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-500/10 bg-emerald-500/2 dark:bg-emerald-500/1 rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-emerald-700/80 uppercase tracking-wider">Total Received</p>
              <h2 className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">{format(totalReceived)}</h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          {(['all', 'pending', 'partial', 'paid'] as FilterStatus[]).map((status) => (
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
              {status === 'paid' ? 'settled' : status}
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

      {/* List content */}
      {items.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 space-y-3">
          <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Banknote className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Credit Records</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Use the "Add Credit" action or checkout a customer on POS credit.</p>
        </div>
      ) : processedCredits.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">No matches found for your filter or query.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Credit Ledgers</h2>
          <div className="space-y-3">
            {processedCredits.map((credit) => {
              const paidAmount = credit.paidAmount ?? 0;
              const remaining = Math.max(0, credit.amount - paidAmount);
              const progressPct = credit.amount > 0 ? Math.min(100, (paidAmount / credit.amount) * 100) : 0;
              const statusCfg = statusConfig[credit.status] ?? statusConfig.pending;

              return (
                <Card
                  key={credit.id}
                  className="group hover:border-primary/30 dark:hover:border-primary/20 hover:shadow-md/5 hover:bg-muted/30 transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden border border-border"
                  onClick={() => setLocation(`/credit/${credit.id}`)}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={cn(
                          'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                          credit.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : credit.status === 'partial'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-orange-500/10 text-orange-600',
                        )}>
                          <User className="h-5.5 w-5.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-foreground truncate text-[15px] leading-tight">
                            {credit.customerName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                            {credit.phone && (
                              <>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {credit.phone}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(credit.date)}
                            </span>
                            {credit.dueDate && (
                              <>
                                <span>•</span>
                                <span className="text-orange-600 font-semibold">
                                  Due {formatDate(parseISO(credit.dueDate), 'MMM d')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border shrink-0', statusCfg.className)}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1 italic px-1">{credit.description}</p>

                    {/* Progress slider */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-end text-xs">
                        <span className="text-muted-foreground font-medium">Settle Progress</span>
                        <span className="font-bold text-foreground">{progressPct.toFixed(0)}% paid</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            progressPct >= 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-orange-500',
                          )}
                          style={{ width: `${Math.max(progressPct, 1.5)}%` }}
                        />
                      </div>
                    </div>

                    {/* Amount Metrics Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-sm">
                      <div className="text-xs text-muted-foreground font-semibold">
                        {credit.status === 'paid' ? 'Full Settlement' : 'Partial Due'}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        {credit.status !== 'paid' ? (
                          <>
                            <span className="text-xs text-muted-foreground">Owed</span>
                            <span className="font-extrabold text-orange-600 text-base">{format(remaining)}</span>
                            <span className="text-xs text-muted-foreground">/ {format(credit.amount)}</span>
                          </>
                        ) : (
                          <span className="font-extrabold text-emerald-600 text-base">{format(credit.amount)}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors ml-1 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
