import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Receipt,
  Plus,
  Calendar,
  Search,
  X,
  ChevronDown,
  Coins,
  ClipboardList,
  Info,
} from 'lucide-react';
import { format as formatDate, parseISO, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { rankSearch } from '@/utils/search/rank';

type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';
type ExpenseTypeFilter = 'manual' | 'auto' | 'all';

const PAGE_SIZE = 30;

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
  { id: 'all', label: 'All Time' },
];

const TYPE_FILTERS: Array<{ id: ExpenseTypeFilter; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'auto', label: 'Auto' },
  { id: 'all', label: 'All' },
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

export default function ExpenseList() {
  const [, setLocation] = useLocation();
  const { items: expenses } = useExpenses();
  const { format } = useCurrency();

  // Filter state
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseTypeFilter>('manual');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset display count on filter changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [debouncedQuery, datePreset, customDateFrom, customDateTo, typeFilter]);

  // Derived date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => formatDate(d, 'yyyy-MM-dd');

    switch (datePreset) {
      case 'today':
        return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) };
      case 'yesterday':
        const y = subDays(now, 1);
        return { from: fmt(startOfDay(y)), to: fmt(endOfDay(y)) };
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

  // Process expenses: enrich → date filter → type filter → search → sort
  const processedExpenses = useMemo(() => {
    // 1. Enrich with searchText (required by rankSearch)
    const enriched = expenses.map((expense) => ({
      ...expense,
      name: expense.description || expense.category,
      searchText: [
        expense.description,
        expense.category,
        expense.paymentMethod,
        expense.notes,
      ].join(' '),
    }));

    // 2. Date filter
    let filtered = enriched;
    const { from, to } = dateRange;
    if (from || to) {
      filtered = filtered.filter((expense) => {
        const day = expense.date.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      });
    }

    // 3. Type filter
    if (typeFilter === 'manual') {
      filtered = filtered.filter((e) => !e.sourcePurchaseId);
    } else if (typeFilter === 'auto') {
      filtered = filtered.filter((e) => e.sourcePurchaseId);
    }

    // 4. Search filter
    if (debouncedQuery.trim()) {
      filtered = rankSearch(filtered, debouncedQuery, filtered.length);
    }

    // 5. Sort by latest date / createdAt
    return filtered.sort((a, b) => {
      const dateCompare = (b.date ?? '').localeCompare(a.date ?? '');
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [expenses, debouncedQuery, dateRange, typeFilter]);

  // Separate manual and auto stats from the currently filtered list
  const { manualCount, manualTotal, autoCount, autoTotal } = useMemo(() => {
    const manual = processedExpenses.filter((e) => !e.sourcePurchaseId);
    const auto = processedExpenses.filter((e) => e.sourcePurchaseId);
    return {
      manualCount: manual.length,
      manualTotal: manual.reduce((sum, e) => sum + e.amount, 0),
      autoCount: auto.length,
      autoTotal: auto.reduce((sum, e) => sum + e.amount, 0),
    };
  }, [processedExpenses]);

  // Pagination
  const visibleExpenses = useMemo(
    () => processedExpenses.slice(0, displayCount),
    [processedExpenses, displayCount],
  );

  const hasMore = displayCount < processedExpenses.length;
  const remaining = processedExpenses.length - displayCount;

  const activeFilterCount = [debouncedQuery !== '', datePreset !== 'all', typeFilter !== 'manual'].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setInputValue('');
    setDatePreset('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setCustomOpen(false);
    setTypeFilter('manual');
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
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {expenses.length} total record{expenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setLocation('/expenses/new')} className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Expense
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

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.id}
            active={typeFilter === t.id}
            onClick={() => setTypeFilter(t.id)}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search description, category, payment…"
          className="pl-9 pr-9"
          aria-label="Search expenses"
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

      {/* Clear filters */}
      {activeFilterCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Clear filters
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFilterCount}
            </Badge>
          </Button>
        </div>
      )}

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

      {/* Dynamic Summary Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {typeFilter === 'manual' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Manual Expenses</p>
                    <p className="font-bold text-lg sm:text-xl leading-tight">{manualCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-base sm:text-lg leading-tight tabular-nums wrap-break-word">
                      {format(manualTotal)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Auto expenses excluded from totals.
              </p>
            </>
          )}

          {typeFilter === 'auto' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Auto Expenses</p>
                    <p className="font-bold text-lg sm:text-xl leading-tight">{autoCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-base sm:text-lg leading-tight tabular-nums wrap-break-word">
                      {format(autoTotal)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Auto expenses are generated from purchases and excluded from reports.
              </p>
            </>
          )}

          {typeFilter === 'all' && (
            <>
              <div className="space-y-3">
                {/* Manual row */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Manual</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="font-bold text-base leading-tight">{manualCount} entries</span>
                      <span className="font-bold text-base leading-tight text-amber-600 tabular-nums wrap-break-word">
                        {format(manualTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Auto row */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Auto</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="font-bold text-base leading-tight">{autoCount} entries</span>
                      <span className="font-bold text-base leading-tight text-slate-600 tabular-nums wrap-break-word">
                        {format(autoTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Manual expenses are included in reports; auto expenses are excluded.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results / Empty states */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No expenses yet</h3>
            <p className="text-muted-foreground text-sm">Start recording expenses to see them here.</p>
            <Button onClick={() => setLocation('/expenses/new')} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </CardContent>
        </Card>
      ) : processedExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">No matching expenses</h3>
            <p className="text-muted-foreground text-sm">
              {activeFilterCount > 0
                ? 'Try a different date, type, or search term.'
                : 'No expenses found for your search.'}
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
        <div className="space-y-5">
          <div className="space-y-2">
            {visibleExpenses.map((expense, index) => {
              return (
                <div
                  key={expense.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/expenses/${expense.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && setLocation(`/expenses/${expense.id}`)}
                  className={`
                    group flex items-center gap-3 rounded-xl border bg-card
                    px-3 py-3 sm:px-4 sm:py-3 cursor-pointer
                    hover:bg-muted/40 active:scale-[0.99]
                    transition-all duration-100 select-none
                    ${expense.sourcePurchaseId ? 'border-l-4 border-l-muted-foreground/20' : ''}
                  `}
                >
                  {/* Serial number */}
                  <div className="text-xs text-muted-foreground tabular-nums w-5 sm:w-6 text-center shrink-0 font-medium">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {expense.description || expense.category}
                      </span>
                      {expense.sourcePurchaseId && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          Auto
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="capitalize">{expense.category}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(parseISO(expense.date), 'dd MMM yyyy')}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="capitalize">{expense.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-sm text-red-600">
                        {format(expense.amount)}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
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
          {!hasMore && processedExpenses.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-2">
              All {processedExpenses.length} expenses shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}